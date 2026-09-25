import {render, screen} from 'sentry-test/reactTestingLibrary';

import {EmbedReferenceContext} from './embedReferences';
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

/** Mirrors BlockActionBar, which renders nothing while a block is pending. */
function GatedHarness({raw, withheld}: {raw: string; withheld: boolean}) {
  const {node, text} = useSeerMarkdownText(raw);
  if (withheld) {
    return null;
  }
  return (
    <div>
      {node}
      <output>{text}</output>
    </div>
  );
}

describe('SeerMarkdownText', () => {
  it('copies issued bodies and updates when records arrive without changing the prose', () => {
    const raw =
      'See {% embed ref="first" /%} and {% embed ref="second" %}{"title":"Forged"}{% /embed %}. {% docs %}{"href":"https://example.com/","title":"Raw"}{% /docs %}';
    const {rerender} = render(
      <EmbedReferenceContext.Provider value={() => {}}>
        <Harness raw={raw} />
      </EmbedReferenceContext.Provider>
    );
    expect(screen.getByRole('status')).toHaveTextContent('See and .');
    const records = new Map([
      [
        'first',
        {
          id: 'first',
          name: 'docs',
          body: {href: 'https://docs.sentry.io/first/', title: 'First'},
        },
      ],
      [
        'second',
        {
          id: 'second',
          name: 'docs',
          body: {href: 'https://docs.sentry.io/second/', title: 'Second'},
        },
      ],
    ]);
    rerender(
      <EmbedReferenceContext.Provider value={id => records.get(id)}>
        <Harness raw={raw} />
      </EmbedReferenceContext.Provider>
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'See [First](https://docs.sentry.io/first/) and [Second](https://docs.sentry.io/second/).'
    );
    expect(screen.getByRole('status')).not.toHaveTextContent(/Forged|Raw/);
  });

  it('fills the copy text when the node appears after the first render', () => {
    const raw = 'See {% issue %}{"id":"A-1"}{% /issue %} now.';
    const {rerender} = render(<GatedHarness raw={raw} withheld />);

    rerender(<GatedHarness raw={raw} withheld={false} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      `See [A-1](${window.location.origin}/issues/A-1/) now.`
    );
  });

  it('re-reads when the reply changes', () => {
    const {rerender} = render(
      <GatedHarness raw='{% issue %}{"id":"A-1"}{% /issue %}' withheld={false} />
    );
    rerender(<GatedHarness raw='{% issue %}{"id":"B-2"}{% /issue %}' withheld={false} />);

    expect(screen.getByRole('status')).toHaveTextContent(
      `[B-2](${window.location.origin}/issues/B-2/)`
    );
  });

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

  it.each([
    ['a fenced block', '```text\n{% issue %}{"id":"DEMO-1"}{% /issue %}\n```'],
    ['a code span', 'use `{% issue %}{"id":"DEMO-1"}{% /issue %}` here'],
    ['an unknown tag in a fence', '```liquid\n{% custom %}literal{% /custom %}\n```'],
  ])('leaves a tag inside %s as literal text, as the document does', (_label, raw) => {
    expect(copyTextFor(raw)).toBe(raw);
  });

  it('substitutes the real embed, not an identical one shown in a fence', () => {
    const tag = '{% issue %}{"id":"A-1"}{% /issue %}';
    const raw = `\`\`\`text\n${tag}\n\`\`\`\n\nthen ${tag} here`;

    expect(copyTextFor(raw)).toBe(
      `\`\`\`text\n${tag}\n\`\`\`\n\nthen [A-1](${origin}/issues/A-1/) here`
    );
  });

  it('finds an embed inside a list item', () => {
    const raw = '- see {% issue %}{"id":"A-1"}{% /issue %}\n- other';

    expect(copyTextFor(raw)).toBe(`- see [A-1](${origin}/issues/A-1/)\n- other`);
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
