import * as generationUtils from '../src/fragment-generation-utils.js';
import * as fragmentUtils from '../src/text-fragment-utils.js';

describe('FragmentGenerationUtils', function() {
  it('can generate a fragment for an exact match', function() {
    document.body.innerHTML = __html__['basic_test.html'];
    const range = document.createRange();
    // firstChild of body is a <p>; firstChild of <p> is a text node.
    range.selectNodeContents(document.body.firstChild.firstChild);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    const result = generationUtils.generateFragment(selection);
    expect(result.status)
        .toEqual(generationUtils.GenerateFragmentStatus.SUCCESS);
    expect(result.fragment.textStart).not.toBeUndefined();
    expect(result.fragment.textStart)
        .toEqual('this is a trivial test of the marking logic.');
    expect(result.fragment.textEnd).toBeUndefined();
    expect(result.fragment.prefix).toBeUndefined();
    expect(result.fragment.suffix).toBeUndefined();
  });

  it('can generate a fragment for a match across block boundaries', function() {
    document.body.innerHTML = __html__['marks_test.html'];
    const range = document.createRange();

    range.setStart(document.getElementById('c'), 0);
    range.setEnd(document.getElementById('f'), 1);

    expect(fragmentUtils.forTesting.normalizeString(range.toString()))
        .toEqual('elaborate fancy div with lots of different stuff');

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    let result = generationUtils.generateFragment(selection);
    expect(result.status)
        .toEqual(generationUtils.GenerateFragmentStatus.SUCCESS);
    expect(result.fragment.textStart).toEqual('elaborate');
    expect(result.fragment.textEnd).toEqual('stuff');
    expect(result.fragment.prefix).toBeUndefined();
    expect(result.fragment.suffix).toBeUndefined();

    range.selectNodeContents(document.getElementById('a'));

    expect(fragmentUtils.forTesting.normalizeString(range.toString().trim()))
        .toEqual('this is a really elaborate fancy div with lots of different stuff in it.');
    
    selection.removeAllRanges();
    selection.addRange(range);
    result = generationUtils.generateFragment(selection);
    expect(result.status)
        .toEqual(generationUtils.GenerateFragmentStatus.SUCCESS);
    expect(result.fragment.textStart).toEqual('This');
    expect(result.fragment.textEnd).toEqual('it');
    expect(result.fragment.prefix).toBeUndefined();
    expect(result.fragment.suffix).toBeUndefined();

  });

  it('can detect if a range contains a block boundary', function() {
    document.body.innerHTML = __html__['marks_test.html'];
    const range = document.createRange();
    const root = document.getElementById('a');

    // Starts/ends inside text nodes that are children of the same block element
    // and have block elements in between them.
    range.setStart(root.firstChild, 3);
    range.setEnd(root.lastChild, 5);
    expect(generationUtils.forTesting.containsBlockBoundary(range))
        .toEqual(true);

    // Starts/ends inside a single text node.
    range.setStart(root.firstChild, 3);
    range.setEnd(root.firstChild, 7);
    expect(generationUtils.forTesting.containsBlockBoundary(range))
        .toEqual(false);

    // Contains other nodes, but none of them are block nodes.
    range.setStart(root.childNodes[4], 3);  // "div with"
    range.setEnd(root.lastChild, 5);
    expect(generationUtils.forTesting.containsBlockBoundary(range))
        .toEqual(false);

    // Detects boundaries that are only the start of a block node.
    range.setStart(root.firstChild, 3);
    range.setEnd(document.getElementById('b').firstChild, 5);  // "a really"
    expect(generationUtils.forTesting.containsBlockBoundary(range))
        .toEqual(true);

    // Detects boundaries that are only the end of a block node.
    range.setStart(document.getElementById('e').firstChild, 1);  // "fancy"
    range.setEnd(root.childNodes[4], 7);                         // "div with"
    expect(generationUtils.forTesting.containsBlockBoundary(range))
        .toEqual(true);
  });

  it('can find a word start inside a text node', function() {
    document.body.innerHTML = __html__['word_bounds_test.html'];
    const elt = document.getElementById('block');

    // elt is an HTML element, not a text node, so we should find -1
    let result = generationUtils.forTesting.findWordStartBoundInTextNode(elt);
    expect(result).toEqual(-1);

    const node = elt.firstChild;
    // With no second arg, we find the first from the end
    result = generationUtils.forTesting.findWordStartBoundInTextNode(node);
    expect(result).toEqual(7);  // Between " " and "b"

    // Second arg in the middle of a word
    result = generationUtils.forTesting.findWordStartBoundInTextNode(node, 10);
    expect(result).toEqual(7);  // Between " " and "b"

    // Second arg immediately *before* a space should give the same output
    result = generationUtils.forTesting.findWordStartBoundInTextNode(node, 6);
    expect(result).toEqual(6)

    // No more spaces to the left of second arg, -1
    result = generationUtils.forTesting.findWordStartBoundInTextNode(node, 3);
    expect(result).toEqual(-1);
  });

  it('can find a word end inside a text node', function() {
    document.body.innerHTML = __html__['word_bounds_test.html'];
    const elt = document.getElementById('block');

    // elt is an HTML element, not a text node, so we should find -1
    let result = generationUtils.forTesting.findWordEndBoundInTextNode(elt);
    expect(result).toEqual(-1);

    const node = elt.firstChild;
    // With no second arg, we find the first
    result = generationUtils.forTesting.findWordEndBoundInTextNode(node);
    expect(result).toEqual(6);  // Between "e" and " "

    // Second arg in the middle of a word
    result = generationUtils.forTesting.findWordEndBoundInTextNode(node, 2);
    expect(result).toEqual(6);  // Between "e" and " "

    // Second arg immediately *after* a space should give the same output
    result = generationUtils.forTesting.findWordEndBoundInTextNode(node, 7);
    expect(result).toEqual(7)

    // No more spaces to the right of second arg, -1
    result = generationUtils.forTesting.findWordEndBoundInTextNode(node, 10);
    expect(result).toEqual(-1);
  });

  it('can expand a range start to a word bound within a node', function() {
    document.body.innerHTML = __html__['word_bounds_test.html'];
    const range = document.createRange();
    const textNodeInBlock = document.getElementById('block').firstChild;

    range.setStart(textNodeInBlock, 10);
    range.setEnd(textNodeInBlock, 12);
    expect(range.toString()).toEqual('ck');

    generationUtils.forTesting.expandRangeStartToWordBound(range);
    expect(range.toString()).toEqual('block');
  });

  it('can expand a range end to a word bound within a node', function() {
    document.body.innerHTML = __html__['word_bounds_test.html'];
    const range = document.createRange();
    const textNodeInBlock = document.getElementById('block').firstChild;

    range.setStart(textNodeInBlock, 0);
    range.setEnd(textNodeInBlock, 3);
    expect(range.toString()).toEqual('Ins');

    generationUtils.forTesting.expandRangeEndToWordBound(range);
    expect(range.toString()).toEqual('Inside');
  });

  it('can expand a range start to an inner block boundary', function() {
    document.body.innerHTML = __html__['word_bounds_test.html'];
    const range = document.createRange();
    const textNodeInBlock = document.getElementById('block').firstChild;

    range.setStart(textNodeInBlock, 3);
    range.setEnd(textNodeInBlock, 12);
    expect(range.toString()).toEqual('ide block');

    generationUtils.forTesting.expandRangeStartToWordBound(range);
    expect(range.toString()).toEqual('Inside block');

    expect(generationUtils.forTesting.containsBlockBoundary(range))
        .toEqual(false);
  });

  it('can expand a range end to an inner block boundary', function() {
    document.body.innerHTML = __html__['word_bounds_test.html'];
    const range = document.createRange();
    const textNodeInBlock = document.getElementById('block').firstChild;

    range.setStart(textNodeInBlock, 0);
    range.setEnd(textNodeInBlock, 10);
    expect(range.toString()).toEqual('Inside blo');

    generationUtils.forTesting.expandRangeEndToWordBound(range);
    expect(range.toString()).toEqual('Inside block');

    expect(generationUtils.forTesting.containsBlockBoundary(range))
        .toEqual(false);
  });

  it('can expand a range end across inline elements', function() {
    document.body.innerHTML = __html__['word_bounds_test.html'];
    const range = document.createRange();
    const inlineTextNode = document.getElementById('inline').firstChild;
    // Get the text node between the <p> and <i> nodes:
    const middleTextNode = document.getElementById('root').childNodes[2];

    range.setStart(middleTextNode, 3);
    range.setEnd(inlineTextNode, 2);
    expect(range.toString()).toEqual('Inli');

    generationUtils.forTesting.expandRangeEndToWordBound(range);
    expect(range.toString()).toEqual('Inline');

    range.setStart(middleTextNode, 3);
    range.setEnd(middleTextNode, 5);
    expect(range.toString()).toEqual('In');

    generationUtils.forTesting.expandRangeEndToWordBound(range);
    expect(range.toString()).toEqual('Inline');
  });

  it('can traverse in order for finding block boundaries', function() {
    document.body.innerHTML = __html__['postorder-tree.html'];
    const walker = document.createTreeWalker(document.getElementById('l'));
    walker.currentNode = document.getElementById('b').firstChild;
    const visited = generationUtils.forTesting.createForwardOverrideMap(walker);
    const traversalOrder = [];
    while (generationUtils.forTesting.forwardTraverse(walker, visited) !=
           null) {
      if (walker.currentNode.id != null) {
        traversalOrder.push(walker.currentNode.id);
      }
    }
    expect(traversalOrder).toEqual([
      'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l'
    ]);
  });

  it('can traverse in reverse order for finding block boundaries', function() {
    document.body.innerHTML = __html__['postorder-tree.html'];
    const walker = document.createTreeWalker(document.getElementById('l'));
    const origin = document.getElementById('k').firstChild;
    walker.currentNode = origin;
    const visited = new Set();
    const traversalOrder = [];
    while (generationUtils.forTesting.backwardTraverse(
               walker, visited, origin) != null) {
      if (walker.currentNode.id != null) {
        traversalOrder.push(walker.currentNode.id);
      }
    }
    expect(traversalOrder).toEqual([
      'k', 'j', 'h', 'i', 'g', 'f', 'c', 'e', 'd', 'b', 'l'
    ]);
  });

  it('can trim leading/trailing boundary characters from a string', function() {
    expect(generationUtils.forTesting.trimBoundary('foo')).toEqual('foo');
    expect(generationUtils.forTesting.trimBoundary(' foo')).toEqual('foo');
    expect(generationUtils.forTesting.trimBoundary('foo ')).toEqual('foo');
    expect(generationUtils.forTesting.trimBoundary('  foo  ')).toEqual('foo');
    expect(generationUtils.forTesting.trimBoundary('\n\'[]!foö...'))
        .toEqual('foö');
    expect(generationUtils.forTesting.trimBoundary('...f...oo...'))
        .toEqual('f...oo');
  })

  it('can find the search space for range-based fragments', function() {
    document.body.innerHTML = __html__['marks_test.html'];
    const range = document.createRange();

    // Simplest case: a whole element with a bunch of block boundaries inside.
    range.selectNodeContents(document.getElementById('a'));
    expect(fragmentUtils.forTesting.normalizeString(
               generationUtils.forTesting.getSearchSpaceForStart(range)))
        .toEqual('this is');
    expect(fragmentUtils.forTesting.normalizeString(
               generationUtils.forTesting.getSearchSpaceForEnd(range)))
        .toEqual('div with lots of different stuff in it');

    // Starts and ends inside a text node. No block boundaries, so we should get
    // an undefined return.
    range.selectNodeContents(document.getElementById('e').firstChild);
    expect(generationUtils.forTesting.getSearchSpaceForStart(range))
        .toBeUndefined();
    expect(generationUtils.forTesting.getSearchSpaceForEnd(range))
        .toBeUndefined();

    // Starts inside one block, ends outside that block
    range.selectNodeContents(document.getElementById('a'));
    range.setStart(document.getElementById('c').firstChild, 0);
    expect(fragmentUtils.forTesting.normalizeString(
               generationUtils.forTesting.getSearchSpaceForStart(range)))
        .toEqual('elaborate');
    expect(fragmentUtils.forTesting.normalizeString(
               generationUtils.forTesting.getSearchSpaceForEnd(range)))
        .toEqual('div with lots of different stuff in it');

    // Ends inside one block, started outside that block
    range.selectNodeContents(document.getElementById('a'));
    range.setEnd(document.getElementById('b').lastChild, 3);
    expect(fragmentUtils.forTesting.normalizeString(
               generationUtils.forTesting.getSearchSpaceForStart(range)))
        .toEqual('this is');
    expect(fragmentUtils.forTesting.normalizeString(
               generationUtils.forTesting.getSearchSpaceForEnd(range)))
        .toEqual('a really elaborate');

    // Starts and ends in different, non-overlapping divs
    range.setStart(document.getElementById('c').firstChild, 0);
    range.setEnd(document.getElementById('e').firstChild, 5);
    expect(fragmentUtils.forTesting.normalizeString(
               generationUtils.forTesting.getSearchSpaceForStart(range)))
        .toEqual('elaborate');
    expect(fragmentUtils.forTesting.normalizeString(
               generationUtils.forTesting.getSearchSpaceForEnd(range)))
        .toEqual('fancy');

    // Boundaries that aren't text nodes
    range.setStart(document.getElementById('a'), 1);
    range.setEnd(document.getElementById('a'), 6);
    expect(fragmentUtils.forTesting.normalizeString(
               generationUtils.forTesting.getSearchSpaceForStart(range)))
        .toEqual('a really elaborate');
    expect(fragmentUtils.forTesting.normalizeString(
               generationUtils.forTesting.getSearchSpaceForEnd(range)))
        .toEqual('div with lots of different stuff');
  });

  it('can generate progressively larger fragments for a range', function() {
    document.body.innerHTML = __html__['range-fragment-test.html'];
    const range = document.createRange();
    range.selectNodeContents(document.getElementById('root'));

    const startSpace = generationUtils.forTesting.getSearchSpaceForStart(range);
    const endSpace = generationUtils.forTesting.getSearchSpaceForEnd(range);

    const factory =
        new generationUtils.forTesting.FragmentFactory(startSpace, endSpace);

    expect(factory.embiggen()).toEqual(true);
    expect(startSpace.substring(0, factory.startOffset)).toEqual('repeat');
    expect(endSpace.substring(factory.endOffset)).toEqual('repeat');

    expect(factory.tryToMakeUniqueFragment()).toBeUndefined();

    expect(factory.embiggen()).toEqual(true);
    expect(startSpace.substring(0, factory.startOffset))
        .toEqual('repeat repeat');
    expect(endSpace.substring(factory.endOffset)).toEqual('repeat repeat');

    expect(factory.tryToMakeUniqueFragment()).toBeUndefined();

    expect(factory.embiggen()).toEqual(true);
    expect(startSpace.substring(0, factory.startOffset))
        .toEqual('repeat repeat repeat');
    expect(endSpace.substring(factory.endOffset))
        .toEqual('repeat repeat repeat');

    expect(factory.tryToMakeUniqueFragment()).toBeUndefined();

    expect(factory.embiggen()).toEqual(true);
    expect(startSpace.substring(0, factory.startOffset))
        .toEqual('repeat repeat repeat unique');
    expect(endSpace.substring(factory.endOffset))
        .toEqual('unique repeat repeat repeat');

    const fragment = factory.tryToMakeUniqueFragment();
    expect(fragment).not.toBeUndefined();
    expect(fragment.textStart).toEqual('repeat repeat repeat unique');
    expect(fragment.textEnd).toEqual('unique repeat repeat repeat');

    expect(factory.embiggen()).toEqual(true);
    expect(startSpace.substring(0, factory.startOffset))
        .toEqual('repeat repeat repeat unique repeat');
    expect(endSpace.substring(factory.endOffset))
        .toEqual('repeat unique repeat repeat repeat');

    expect(factory.embiggen()).toEqual(true);
    expect(factory.embiggen()).toEqual(true);
    expect(factory.embiggen()).toEqual(false);
  });
});
