import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useSeerMarkdownText} from './markdownText';

function Harness({raw}: {raw: string}) {
  const {node, text} = useSeerMarkdownText(raw);
  return (
    <div>
      {node}
      <output>{text}</output>
    </div>
  );
}

function copyTextFor(raw: string) {
  render(<Harness raw={raw} />);
  return screen.getByRole('status').textContent;
}

describe('SeerMarkdownText', () => {
  const origin = window.location.origin;

  it('leaves a reply with no embeds exactly as written', () => {
    const raw = '## Heading\n\nSome **bold** prose with a [link](https://example.com).';

    expect(copyTextFor(raw)).toBe(raw);
  });

  it('replaces an embed tag with what the embed serializes to', () => {
    expect(
      copyTextFor('See {% issue %}{"id":"JAVASCRIPT-22SP"}{% /issue %} for more.')
    ).toBe(`See [JAVASCRIPT-22SP](${origin}/issues/JAVASCRIPT-22SP/) for more.`);
  });

  it('keeps the prose around several embeds intact', () => {
    const raw =
      'First {% issue %}{"id":"A-1"}{% /issue %} then {% issue %}{"id":"B-2"}{% /issue %}.';

    expect(copyTextFor(raw)).toBe(
      `First [A-1](${origin}/issues/A-1/) then [B-2](${origin}/issues/B-2/).`
    );
  });

  it('does not re-serialize the markdown around a tag', () => {
    const raw =
      '- item one\n- item `two`\n\n> quoted\n\n{% issue %}{"id":"C-3"}{% /issue %}';

    expect(copyTextFor(raw)).toBe(
      `- item one\n- item \`two\`\n\n> quoted\n\n[C-3](${origin}/issues/C-3/)`
    );
  });

  it('drops a tag whose embed is not registered, as the document does', () => {
    expect(copyTextFor('before {% nonsense %}{"a":1}{% /nonsense %} after')).toBe(
      'before  after'
    );
  });

  it('drops an embed whose data fails validation', () => {
    expect(copyTextFor('before {% issue %}{"wrong":"shape"}{% /issue %} after')).toBe(
      'before  after'
    );
  });
});
