import {fenceContent} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentFencing';

const FENCE = '```';

describe('fenceContent', () => {
  it('fences a standalone HTML block as an html code block', () => {
    expect(fenceContent('<div>markup</div>')).toBe(`

${FENCE}html
<div>markup</div>
${FENCE}

`);
  });

  it('fences a standalone JSON block as a json code block', () => {
    expect(fenceContent('{"a": 1, "b": 2}')).toBe(`

${FENCE}json
{"a": 1, "b": 2}
${FENCE}

`);
  });

  it('fences a Python-repr dict as a json code block', () => {
    expect(fenceContent("{'a': 1, 'b': 2}")).toBe(`

${FENCE}json
{'a': 1, 'b': 2}
${FENCE}

`);
  });

  it('fences an attributed HTML block', () => {
    expect(fenceContent('<div class="box">hi</div>')).toBe(`

${FENCE}html
<div class="box">hi</div>
${FENCE}

`);
  });

  it('fences a multi-line HTML block as a single code block', () => {
    const input = `<ul>
  <li>one</li>
  <li>two</li>
</ul>`;
    expect(fenceContent(input)).toBe(`

${FENCE}html
${input}
${FENCE}

`);
  });

  it('fences a multi-line HTML block surrounded by prose', () => {
    const input = `Here is the markup:
<div>
  <span>hi</span>
</div>
Done.`;
    expect(fenceContent(input)).toBe(`Here is the markup:


${FENCE}html
<div>
  <span>hi</span>
</div>
${FENCE}


Done.`);
  });

  it('wraps JSON that has prose beside it in inline code', () => {
    expect(fenceContent('the payload {"a":1,"b":2} failed')).toBe(
      'the payload `{"a":1,"b":2}` failed'
    );
  });

  it('leaves JSON glued to other tokens untouched', () => {
    const input = 'call with key={"a":1,"b":2} now';
    expect(fenceContent(input)).toBe(input);
  });

  it('leaves trivial braces untouched', () => {
    const input = 'look at {} and [] here';
    expect(fenceContent(input)).toBe(input);
  });

  it('does not re-fence content already inside a code fence', () => {
    const input = `${FENCE}json
{"a":1}
${FENCE}`;
    expect(fenceContent(input)).toBe(input);
  });

  it('does not fence unknown/custom tags as HTML', () => {
    const input = '<thinking>a deep thought</thinking>';
    expect(fenceContent(input)).toBe(input);
  });

  it('fences the outer HTML block, not JSON nested inside it', () => {
    const input = `<pre>
{"a": 1, "b": 2}
</pre>`;
    expect(fenceContent(input)).toBe(`

${FENCE}html
${input}
${FENCE}

`);
  });

  it('fences the outer JSON block, not HTML nested in a string value', () => {
    const input = `{
  "markup": "<div>x</div>"
}`;
    expect(fenceContent(input)).toBe(`

${FENCE}json
${input}
${FENCE}

`);
  });
});
