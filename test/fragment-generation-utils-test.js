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
});
