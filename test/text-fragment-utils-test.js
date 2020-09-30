import * as utils from '../src/text-fragment-utils.js';

// A normalizing helper function to try and compare extracted marks in a way
// that's robust-ish to reformatting/prettifying of the HTML input files.
const marksArrayToString = (marks) => {
  // Extract text content with normalized whitespace
  const text = marks.map((node) =>
    node.textContent.replace(/[\t\n\r ]+/g, ' '),
  );
  // Join, re-normalize (because block elements can add extra whitespace if
  // HTML contains newlines), and trim.
  return text
    .join('')
    .replace(/[\t\n\r ]+/g, ' ')
    .trim();
};

describe('TextFragmentUtils', function () {
  it('gets directives from a hash', function () {
    const directives = utils.getFragmentDirectives('#foo:~:text=bar&text=baz');
    expect(directives.text).toEqual(['bar', 'baz']);
  });

  it('marks simple matching text', function () {
    document.body.innerHTML = __html__['basic_test.html'];

    const directive = { text: [{ textStart: 'trivial test of' }] };
    utils.processFragmentDirectives(directive);

    expect(document.body.innerHTML).toEqual(
      __html__['basic_test.expected.html'],
    );
  });

  it('works with range-based matches across block boundaries', function () {
    document.body.innerHTML = window.__html__['complicated-layout.html'];
    const directives = utils.getFragmentDirectives(
      '#:~:text=is%20a%20test,And%20another%20one',
    );
    const parsedDirectives = utils.parseFragmentDirectives(directives);
    const processedDirectives = utils.processFragmentDirectives(
      parsedDirectives,
    )['text'];
    const marks = processedDirectives[0];
    expect(marksArrayToString(marks)).toEqual(
      'is a hard test. A list item. Another one. hey And another one',
    );
  });

  it('works with range-based matches within block boundaries', function () {
    document.body.innerHTML = window.__html__['complicated-layout.html'];
    const directives = utils.getFragmentDirectives('#:~:text=And,one');
    const parsedDirectives = utils.parseFragmentDirectives(directives);
    const processedDirectives = utils.processFragmentDirectives(
      parsedDirectives,
    )['text'];
    const marks = processedDirectives[0];
    expect(marksArrayToString(marks)).toEqual('And another one');
  });

  // The word 'a' is an ambiguous match in this document. Test that a prefix
  // allows us to get the right instance.
  it('works with prefix-based matches within a node', function () {
    document.body.innerHTML = window.__html__['complicated-layout.html'];
    const directives = utils.getFragmentDirectives('#:~:text=is-,a');
    const parsedDirectives = utils.parseFragmentDirectives(directives);
    const processedDirectives = utils.processFragmentDirectives(
      parsedDirectives,
    )['text'];
    const marks = processedDirectives[0];
    expect(marksArrayToString(marks)).toEqual('a');
    expect(marks[0].parentElement.id).toEqual('root');
  });

  it('works with prefix-based matches across block boundaries', function () {
    document.body.innerHTML = window.__html__['complicated-layout.html'];
    const directives = utils.getFragmentDirectives('#:~:text=test-,a');
    const parsedDirectives = utils.parseFragmentDirectives(directives);
    const processedDirectives = utils.processFragmentDirectives(
      parsedDirectives,
    )['text'];
    const marks = processedDirectives[0];
    expect(marksArrayToString(marks)).toEqual('A');
    expect(marks[0].parentElement.id).toEqual('first-p');
  });

  // The word 'a' is an ambiguous match in this document. Test that a suffix
  // allows us to get the right instance.
  it('works with suffix-based matches within a node', function () {
    document.body.innerHTML = window.__html__['complicated-layout.html'];
    const directives = utils.getFragmentDirectives('#:~:text=a,-list');
    const parsedDirectives = utils.parseFragmentDirectives(directives);
    const processedDirectives = utils.processFragmentDirectives(
      parsedDirectives,
    )['text'];
    const marks = processedDirectives[0];
    expect(marksArrayToString(marks)).toEqual('A');
    expect(marks[0].parentElement.id).toEqual('first-p');
  });

  // This also lets us check that non-visible nodes are skipped.
  it('works with suffix-based matches across block boundaries', function () {
    document.body.innerHTML = window.__html__['complicated-layout.html'];
    const directives = utils.getFragmentDirectives('#:~:text=a,-test');
    const parsedDirectives = utils.parseFragmentDirectives(directives);
    const processedDirectives = utils.processFragmentDirectives(
      parsedDirectives,
    )['text'];
    const marks = processedDirectives[0];
    expect(marksArrayToString(marks)).toEqual('a');
    expect(marks[0].parentElement.id).toEqual('root');
  });

  it('can distinguish ambiguous matches using a prefix/suffix', function () {
    document.body.innerHTML = window.__html__['ambiguous-match.html'];
    const directives = utils.getFragmentDirectives('#:~:text=prefix2-,target,target,-suffix1');
    const parsedDirectives = utils.parseFragmentDirectives(directives);
    const processedDirectives = utils.processFragmentDirectives(
      parsedDirectives,
    )['text'];
    const marks = processedDirectives[0];
    expect(marks[0].parentElement.id).toEqual('target2');
    expect(marks[marks.length - 1].parentElement.id).toEqual('target4');
    expect(marksArrayToString(marks)).toEqual("target suffix2 prefix1 target suffix2 prefix2 target");
  });
  
  it('will ignore text matches without a matching prefix', function () {
    document.body.innerHTML = window.__html__['ambiguous-match.html'];
    const directives = utils.getFragmentDirectives('#:~:text=prefix3-,target');
    const parsedDirectives = utils.parseFragmentDirectives(directives);
    const processedDirectives = utils.processFragmentDirectives(
      parsedDirectives,
    )['text'];
    expect(processedDirectives[0].length).toEqual(0);
  });
  
  it('will ignore text matches without a matching suffix', function () {
    document.body.innerHTML = window.__html__['ambiguous-match.html'];
    const directives = utils.getFragmentDirectives('#:~:text=prefix1-,target,-suffix3');
    const parsedDirectives = utils.parseFragmentDirectives(directives);
    const processedDirectives = utils.processFragmentDirectives(
      parsedDirectives,
    )['text'];
    expect(processedDirectives[0].length).toEqual(0);
  });
  
  it('can wrap a complex structure in <mark>s', function () {
    document.body.innerHTML = __html__['marks_test.html'];
    const range = document.createRange();
    range.setStart(document.getElementById('a').firstChild, 0);
    const lastChild = document.getElementById('a').lastChild;
    range.setEnd(lastChild, lastChild.textContent.length);
    const marks = utils.forTesting.markRange(range);

    // Extract text content of nodes, normalizing whitespace.
    expect(marksArrayToString(marks)).toEqual(
      'This is a really elaborate fancy div with lots of different stuff in it.',
    );
    
    utils.removeMarks(marks);
    expect(document.body.innerHTML).toEqual(__html__['marks_test.html']);
  });

  it('can wrap a portion of a single text node in <mark>s', function () {
    document.body.innerHTML = __html__['marks_test.html'];
    const range = document.createRange();
    range.setStart(document.getElementById('f').firstChild, 5);
    range.setEnd(document.getElementById('f').firstChild, 17);
    const marks = utils.forTesting.markRange(range);
    expect(marksArrayToString(marks)).toEqual('of different');
    
    utils.removeMarks(marks);
    expect(document.body.innerHTML).toEqual(__html__['marks_test.html']);
  });

  it('can <mark> a range covering many tree depths', function () {
    document.body.innerHTML = __html__['marks_test.html'];
    const range = document.createRange();
    range.setStart(document.getElementById('c').firstChild, 0);
    range.setEnd(document.getElementById('e').nextSibling, 6);
    const marks = utils.forTesting.markRange(range);
    expect(marksArrayToString(marks)).toEqual('elaborate fancy div');
    
    utils.removeMarks(marks);
    expect(document.body.innerHTML).toEqual(__html__['marks_test.html']);
  });

  it('can normalize text', function () {
    // Dict mapping inputs to expected outputs.
    const testCases = {
      '': '',
      ' foo123 ': ' foo123 ',
      // Various whitespace is collapsed; capitals become lowercase
      '\n Kirby\t Puckett   ': ' kirby puckett ',
      // Latin accent characters are removed
      ñîçè: 'nice',
      // Some Japanese characters like パ can be rendered with 1 or 2 code
      // points; the normalized version will always use two.
      '『パープル・レイン』': '『ハ\u309Aーフ\u309Aル・レイン』',
      // Chinese doesn't use diacritics and is unchanged.
      紫雨: '紫雨',
      // Cyrilic has lower case
      'Кирилл Капризов': 'кирилл капризов',
      // Turkish has separate letters I/İ; since we don't have a
      // high-confidence locale, we normalize both of these to 'i'.
      'İstanbul Istanbul': 'istanbul istanbul',
    };

    for (const input of Object.getOwnPropertyNames(testCases)) {
      expect(utils.forTesting.normalizeString(input)).toEqual(testCases[input]);
    }
  });

  it('can advance a range start past an offset', function () {
    document.body.innerHTML = __html__['marks_test.html'];
    const range = document.createRange();
    const elt = document.getElementById('a').firstChild;
    range.setStart(elt, 0);
    range.setEndAfter(document.getElementById('b').firstChild);
    expect(utils.forTesting.normalizeString(range.toString())).toEqual(
      ' this is a really ',
    );

    // Offset 3 is between whitespace and 'T'. Advancing past it should
    // chop off the 'T'
    utils.forTesting.advanceRangeStartPastOffset(range, elt, 3);
    expect(utils.forTesting.normalizeString(range.toString())).toEqual(
      'his is a really ',
    );

    // 999 is way out of range, so this should just move to after the node.
    utils.forTesting.advanceRangeStartPastOffset(range, elt, 999);
    expect(utils.forTesting.normalizeString(range.toString())).toEqual(
      ' a really ',
    );
  });

  it('can advance a range start past boundary chars', function () {
    document.body.innerHTML = __html__['marks_test.html'];
    const range = document.createRange();
    const elt = document.getElementById('a').firstChild;
    range.setStart(elt, 0);
    range.setEndAfter(document.getElementById('b').firstChild);
    expect(utils.forTesting.normalizeString(range.toString())).toEqual(
      ' this is a really ',
    );

    // From the start of the node, this is essentially just trimming off the
    // leading whitespace.
    utils.forTesting.advanceRangeStartToNonBoundary(range);
    expect(utils.forTesting.normalizeString(range.toString())).toEqual(
      'this is a really ',
    );

    // If we repeat, nothing changes, since the range already starts on a
    // non-boundary char.
    utils.forTesting.advanceRangeStartToNonBoundary(range);
    expect(utils.forTesting.normalizeString(range.toString())).toEqual(
      'this is a really ',
    );

    // Offset 10 is after the last non-boundary char in this node. Advancing
    // will move past this node's trailing whitespace, into the next text node,
    // and past that node's leading whitespace.
    range.setStart(elt, 10);
    utils.forTesting.advanceRangeStartToNonBoundary(range);
    expect(utils.forTesting.normalizeString(range.toString())).toEqual(
      'a really ',
    );
  });

  // Internally, this also tests the boundary point finding logic.
  it('can find a range from a node list', function () {
    document.body.innerHTML = __html__['boundary-points.html'];
    const rootNode = document.getElementById('root');
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const allTextNodes = [];
    let textNode = walker.nextNode();
    while (textNode != null) {
      allTextNodes.push(textNode);
      textNode = walker.nextNode();
    }

    // Test cases are substrings of the normalized text content of the document.
    // The goal in each case is to produce a range pointing to the substring.
    const simpleTestCases = [
      // Starts at range boundary + ends at a deeper level
      ' this text has a',
      // Ends at a shallower level, and immediately after a decomposed char
      'has a lot of ハ\u309A',
      // Starts immediately before a decomposed char, and is entirely within
      // one text node
      'フ\u309A stuff gøing on ',
    ];

    const docRange = document.createRange();
    docRange.selectNodeContents(rootNode);

    for (const input of simpleTestCases) {
      const range = utils.forTesting.findRangeFromNodeList(
        input,
        docRange,
        allTextNodes,
      );
      expect(range)
        .withContext('No range found for <' + input + '>')
        .not.toBeUndefined();
      expect(utils.forTesting.normalizeString(range.toString())).toEqual(input);
    }

    // We expect a match for 'a' to find the word 'a', but not the letter inside
    // the word 'has'. We verify this by checking that the range's common
    // ancestor is the <b> tag, which in the HTML doc contains the word 'a'.
    const aRange = utils.forTesting.findRangeFromNodeList(
      'a',
      docRange,
      allTextNodes,
    );
    expect(aRange).withContext('No range found for <a>').not.toBeUndefined();
    expect(aRange.commonAncestorContainer.parentElement.nodeName).toEqual('B');

    // We expect no match to be found for a partial-word substring ("tüf" should
    // not match "stüff" in the document).
    const nullRange = utils.forTesting.findRangeFromNodeList(
      'tüf',
      docRange,
      allTextNodes,
    );
    expect(nullRange)
      .withContext('Unexpectedly found match for <tüf>')
      .toBeUndefined();
  });

  it('can detect if a substring is word-bounded', function () {
    const trueCases = [
      { data: 'test', substring: 'test' },
      { data: 'multiword test string', substring: 'test' },
      { data: 'the quick, brown dog', substring: 'the quick' },
      { data: 'a "quotation" works', substring: 'quotation' },
      { data: 'other\nspacing\t', substring: 'spacing' },
      // Japanese has no spaces, so only punctuation works as a boundary.
      { data: 'はい。いいえ。', substring: 'いいえ' },
      { data: '『パープル・レイン』', substring: 'パープル' },
    ];

    const falseCases = [
      { data: 'testing', substring: 'test' },
      { data: 'attest', substring: 'test' },
      { data: 'untested', substring: 'test' },
      // アルバム is an actual word. With proper Japanese word segmenting we
      // could move this to the true cases, but for now we expect it to be
      // rejected.
      {
        data:
          'プリンス・アンド・ザ・レヴォリューションによる1984年のアルバム。',
        substring: 'アルバム',
      },
    ];

    for (const input of trueCases) {
      const index = input.data.search(input.substring);
      expect(
        utils.forTesting.isWordBounded(
          input.data,
          index,
          input.substring.length,
        ),
      )
        .withContext(
          'Is <' + input.substring + '> word-bounded in <' + input.data + '>',
        )
        .toEqual(true);
    }
    for (const input of falseCases) {
      const index = input.data.search(input.substring);
      expect(
        utils.forTesting.isWordBounded(
          input.data,
          index,
          input.substring.length,
        ),
      )
        .withContext(
          'Is <' + input.substring + '> word-bounded in <' + input.data + '>',
        )
        .toEqual(false);
    }
  });
});
