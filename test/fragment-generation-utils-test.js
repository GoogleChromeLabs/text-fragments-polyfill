import * as utils from '../src/fragment-generation-utils.js';

describe('FragmentGenerationUtils', function() {
  it('can generate a fragment for an exact match', function() {
    document.body.innerHTML = __html__['basic_test.html'];
    const range = document.createRange();
    // firstChild of body is a <p>; firstChild of <p> is a text node.
    range.selectNodeContents(document.body.firstChild.firstChild);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);

    const result = utils.generateFragment(selection);
    expect(result.status).toEqual(utils.GenerateFragmentStatus.SUCCESS);
    expect(result.fragment.textStart).not.toBeUndefined();
    expect(result.fragment.textStart)
        .toEqual('this is a trivial test of the marking logic.');
    expect(result.fragment.textEnd).toBeUndefined();
    expect(result.fragment.prefix).toBeUndefined();
    expect(result.fragment.suffix).toBeUndefined();
  });

  it('can find a word start inside a text node', function() {
    document.body.innerHTML = __html__['word_bounds_test.html'];
    const elt = document.getElementById('block');

    // elt is an HTML element, not a text node, so we should find -1
    let result = utils.forTesting.findWordStartBoundInTextNode(elt);
    expect(result).toEqual(-1);

    const node = elt.firstChild;
    // With no second arg, we find the first from the end
    result = utils.forTesting.findWordStartBoundInTextNode(node);
    expect(result).toEqual(7);  // Between " " and "b"

    // Second arg in the middle of a word
    result = utils.forTesting.findWordStartBoundInTextNode(node, 10);
    expect(result).toEqual(7);  // Between " " and "b"

    // Second arg immediately *before* a space should give the same output
    result = utils.forTesting.findWordStartBoundInTextNode(node, 6);
    expect(result).toEqual(6)

    // No more spaces to the left of second arg, -1
    result = utils.forTesting.findWordStartBoundInTextNode(node, 3);
    expect(result).toEqual(-1);
  });

  it('can find a word end inside a text node', function() {
    document.body.innerHTML = __html__['word_bounds_test.html'];
    const elt = document.getElementById('block');

    // elt is an HTML element, not a text node, so we should find -1
    let result = utils.forTesting.findWordEndBoundInTextNode(elt);
    expect(result).toEqual(-1);

    const node = elt.firstChild;
    // With no second arg, we find the first
    result = utils.forTesting.findWordEndBoundInTextNode(node);
    expect(result).toEqual(6);  // Between "e" and " "

    // Second arg in the middle of a word
    result = utils.forTesting.findWordEndBoundInTextNode(node, 2);
    expect(result).toEqual(6);  // Between "e" and " "

    // Second arg immediately *after* a space should give the same output
    result = utils.forTesting.findWordEndBoundInTextNode(node, 7);
    expect(result).toEqual(7)

    // No more spaces to the right of second arg, -1
    result = utils.forTesting.findWordEndBoundInTextNode(node, 10);
    expect(result).toEqual(-1);
  });

  it('can expand a range start to a word bound within a node', function() {
    document.body.innerHTML = __html__['word_bounds_test.html'];
    const range = document.createRange();
    const textNodeInBlock = document.getElementById('block').firstChild;

    range.setStart(textNodeInBlock, 10);
    range.setEnd(textNodeInBlock, 12);
    expect(range.toString()).toEqual('ck');

    utils.forTesting.expandRangeStartToWordBound(range);
    expect(range.toString()).toEqual('block');
  });

  it('can expand a range end to a word bound within a node', function() {
    document.body.innerHTML = __html__['word_bounds_test.html'];
    const range = document.createRange();
    const textNodeInBlock = document.getElementById('block').firstChild;

    range.setStart(textNodeInBlock, 0);
    range.setEnd(textNodeInBlock, 3);
    expect(range.toString()).toEqual('Ins');

    utils.forTesting.expandRangeEndToWordBound(range);
    expect(range.toString()).toEqual('Inside');
  });

  it('can expand a range start to an inner block boundary', function() {
    document.body.innerHTML = __html__['word_bounds_test.html'];
    const range = document.createRange();
    const textNodeInBlock = document.getElementById('block').firstChild;

    range.setStart(textNodeInBlock, 3);
    range.setEnd(textNodeInBlock, 12);
    expect(range.toString()).toEqual('ide block');

    utils.forTesting.expandRangeStartToWordBound(range);
    expect(range.toString()).toEqual('Inside block');
  });

  it('can expand a range end to an inner block boundary', function() {
    document.body.innerHTML = __html__['word_bounds_test.html'];
    const range = document.createRange();
    const textNodeInBlock = document.getElementById('block').firstChild;

    range.setStart(textNodeInBlock, 0);
    range.setEnd(textNodeInBlock, 10);
    expect(range.toString()).toEqual('Inside blo');

    utils.forTesting.expandRangeEndToWordBound(range);
    expect(range.toString()).toEqual('Inside block');
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

    utils.forTesting.expandRangeEndToWordBound(range);
    expect(range.toString()).toEqual('Inline');

    range.setStart(middleTextNode, 3);
    range.setEnd(middleTextNode, 5);
    expect(range.toString()).toEqual('In');

    utils.forTesting.expandRangeEndToWordBound(range);
    console.log(range.endContainer.nodeType + range.endContainer.tagName);
    expect(range.toString()).toEqual('Inline');
  });

  it('can postorder traverse', function() {
    document.body.innerHTML = __html__['postorder-tree.html'];
    const walker = document.createTreeWalker(document.getElementById('h'));
    walker.currentNode = document.getElementById('b').firstChild;
    const visited = utils.forTesting.prepareVisitedSet(walker);
    const traversalOrder = [];
    while (utils.forTesting.forwardTraverse(walker, visited) != null) {
      if (walker.currentNode.id != null)
        traversalOrder.push(walker.currentNode.id);
    }
    expect(traversalOrder).toEqual(['b', 'c', 'e', 'g', 'f', 'd', 'h']);
  })
});
