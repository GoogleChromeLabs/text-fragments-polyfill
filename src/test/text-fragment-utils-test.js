import * as utils from '../text-fragment-utils.js';

describe('TextFragmentUtils', function () {
  it('gets directives from a hash', function () {
    const directives = utils.getFragmentDirectives('#foo:~:text=bar&text=baz');
    expect(directives.text).toEqual(['bar', 'baz']);
  });
  
  it('marks simple matching text', function () {
    console.log(__html__);
    
    document.body.innerHTML = __html__['basic_test.html'];
    
    var directive = { text: [{textStart: 'trivial test of'}]};
    utils.processFragmentDirectives(directive);
    
    expect(document.body.innerHTML)
        .toEqual(__html__['basic_test.expected.html']);
  });
});
