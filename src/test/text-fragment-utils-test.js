import * as utils from '../text-fragment-utils.js';

// A normalizing helper function to try and compare extracted marks in a way
// that's robust-ish to reformatting/prettifying of the HTML input files.
const marksArrayToString = (marks) => {
  // Extract text content with normalized whitespace
  const text = marks.map((node) => node.textContent.replace(/[\t\n\r ]+/g, ' '));
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
    console.log(__html__);

    document.body.innerHTML = __html__['basic_test.html'];

    const directive = { text: [{ textStart: 'trivial test of' }] };
    utils.processFragmentDirectives(directive);

    expect(document.body.innerHTML).toEqual(
      __html__['basic_test.expected.html'],
    );
  });

  it('works with complexe layouts', function () {
    document.body.innerHTML = window.__html__['complicated-layout.html'];
    const directives = utils.getFragmentDirectives(
      '#:~:text=is%20a%20test,And%20another%20on',
    );
    const parsedDirectives = utils.parseFragmentDirectives(directives);
    const processedDirectives = utils.processFragmentDirectives(
      parsedDirectives,
    )['text'];
    const marks = processedDirectives[0];
    expect(marksArrayToString(marks)).toEqual('is a hard test. A list item. Another one. hey And another on');
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
  });

  it('can wrap a portion of a single text node in <mark>s', function () {
    document.body.innerHTML = __html__['marks_test.html'];
    const range = document.createRange();
    range.setStart(document.getElementById('f').firstChild, 5);
    range.setEnd(document.getElementById('f').firstChild, 17);
    const marks = utils.forTesting.markRange(range);
    expect(marksArrayToString(marks)).toEqual('of different');
  });

  it('can <mark> a range covering many tree depths', function () {
    document.body.innerHTML = __html__['marks_test.html'];
    const range = document.createRange();
    range.setStart(document.getElementById('c').firstChild, 0);
    range.setEnd(document.getElementById('e').nextSibling, 6);
    const marks = utils.forTesting.markRange(range);
    expect(marksArrayToString(marks)).toEqual('elaborate fancy div');
  });
});
