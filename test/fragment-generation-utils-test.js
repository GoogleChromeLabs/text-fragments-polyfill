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

  it('can find a word boundary inside a text node', function() {
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

  it('can expand a range start across inline elements', function() {
    document.body.innerHTML = __html__['word_bounds_test.html'];
    const range = document.createRange();
    const inlineTextNode = document.getElementById('inline').firstChild;
    const lastTextNode = document.getElementById('root').lastChild;

    range.setStart(inlineTextNode, 1);
    range.setEnd(lastTextNode, 2);
    expect(range.toString()).toEqual('ine');

    utils.forTesting.expandRangeStartToWordBound(range);
    expect(range.toString()).toEqual('Inline');

    range.setStart(lastTextNode, 1);
    range.setEnd(lastTextNode, 2);
    expect(range.toString()).toEqual('e');

    utils.forTesting.expandRangeStartToWordBound(range);
    expect(range.toString()).toEqual('Inline');
  });
});
