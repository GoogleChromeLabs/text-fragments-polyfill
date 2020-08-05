import * as utils from '../text-fragment-utils.js';

describe('TextFragmentUtils', function () {
  it('gets directives from a hash', function () {
    const directives = utils.getFragmentDirectives('#foo:~:text=bar&text=baz');
    expect(directives.text).toEqual(['bar', 'baz']);
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
    expect(processedDirectives.length).toEqual(1);
    expect(marks.length).toBeGreaterThan(1);
  });

  it('marks simple matching text', function () {
    console.log(__html__);
    
    document.body.innerHTML = __html__['basic_test.html'];
    
    var directive = { text: [{textStart: 'trivial test of'}]};
    utils.processFragmentDirectives(directive);
    
    expect(document.body.innerHTML)
        .toEqual(__html__['basic_test.expected.html']);
  });

  it('works with complexe layouts', function () {
    document.body.innerHTML = window.__html__['complicated-layout.html'];
    const directives = utils.getFragmentDirectives(
      '#:~:text=is%20a%20test,And%20another%20one',
    );
    const parsedDirectives = utils.parseFragmentDirectives(directives);
    const processedDirectives = utils.processFragmentDirectives(
      parsedDirectives,
    )['text'];
    const marks = processedDirectives[0];
    expect(processedDirectives.length).toEqual(1);
    expect(marks.length).toBeGreaterThan(1);
  });
});
