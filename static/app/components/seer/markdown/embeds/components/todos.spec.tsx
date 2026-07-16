import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {SeerConversationProvider} from 'sentry/components/seer/markdown/embeds/conversation';
import {SeerEmbedBlockContext} from 'sentry/components/seer/markdown/embeds/registry';

const todosTag = (items: Array<{content: string; status: string}>) =>
  `{% todos %}${JSON.stringify({items})}{% /todos %}`;

const FIRST_TAG = todosTag([
  {content: 'Investigate spans', status: 'completed'},
  {content: 'Check error rates', status: 'in_progress'},
]);
const LATEST_TAG = todosTag([
  {content: 'Investigate spans', status: 'completed'},
  {content: 'Check error rates', status: 'completed'},
  {content: 'Write summary', status: 'pending'},
]);

const block = (id: string, content: string | null) => ({id, message: {content}});

function renderConversation(
  blocks: Array<{id: string; message: {content: string | null}}>
) {
  render(
    <SeerConversationProvider blocks={blocks}>
      {blocks.map(b => (
        <SeerEmbedBlockContext key={b.id} value={b.id}>
          <SeerMarkdown raw={b.message.content ?? ''} />
        </SeerEmbedBlockContext>
      ))}
    </SeerConversationProvider>
  );
}

describe('Todos embed', () => {
  it('renders the checklist only for the latest todos block', () => {
    renderConversation([
      block('a', FIRST_TAG),
      block('b', 'plain prose'),
      block('c', `intro\n\n${LATEST_TAG}`),
    ]);

    // Only the latest snapshot's items render — 'Write summary' is unique to it.
    expect(screen.getByText('Write summary')).toBeInTheDocument();
    // Items shared by both snapshots appear exactly once (older embed renders null).
    expect(screen.getAllByText('Investigate spans')).toHaveLength(1);
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
  });

  it('skips tags with invalid JSON or invalid shape when deriving the latest', () => {
    renderConversation([
      block('a', FIRST_TAG),
      block('b', '{% todos %}not json{% /todos %}'),
      block('c', '{% todos %}{"items":[{"content":"x","status":"bogus"}]}{% /todos %}'),
    ]);

    // 'a' holds the last valid snapshot, so its two items render.
    expect(screen.getByText('Check error rates')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('ignores tags inside code fences when deriving the latest', () => {
    // A tag quoted in a code fence is code, not an embed — the fold must see
    // exactly what the renderer's lexer sees.
    renderConversation([
      block('a', FIRST_TAG),
      block('b', `Example syntax:\n\n\`\`\`\n${LATEST_TAG}\n\`\`\``),
    ]);

    expect(screen.getByText('Check error rates')).toBeInTheDocument();
    expect(screen.getAllByRole('checkbox')).toHaveLength(2);
  });

  it('renders standalone when no provider is present (stories/previews)', () => {
    render(<SeerMarkdown raw={LATEST_TAG} />);
    expect(screen.getByText('Write summary')).toBeInTheDocument();
  });

  it('marks completed items as checked', () => {
    render(<SeerMarkdown raw={LATEST_TAG} />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes).toHaveLength(3);
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[2]).not.toBeChecked();
  });
});
