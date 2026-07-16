import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {
  findLatestTodosBlockId,
  SeerTodosProvider,
} from 'sentry/components/seer/markdown/embeds/components/todos';
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

describe('findLatestTodosBlockId', () => {
  it('returns the last block containing a valid todos tag', () => {
    expect(
      findLatestTodosBlockId([
        {id: 'a', content: FIRST_TAG},
        {id: 'b', content: 'plain prose'},
        {id: 'c', content: `intro\n\n${LATEST_TAG}`},
        {id: 'd', content: 'trailing prose'},
      ])
    ).toBe('c');
  });

  it('skips tags with invalid JSON or invalid shape', () => {
    expect(
      findLatestTodosBlockId([
        {id: 'a', content: FIRST_TAG},
        {id: 'b', content: '{% todos %}not json{% /todos %}'},
        {
          id: 'c',
          content: '{% todos %}{"items":[{"content":"x","status":"bogus"}]}{% /todos %}',
        },
      ])
    ).toBe('a');
  });

  it('returns null when no block has a todos tag', () => {
    expect(
      findLatestTodosBlockId([
        {id: 'a', content: 'prose'},
        {id: 'b', content: null},
      ])
    ).toBeNull();
  });
});

describe('Todos embed', () => {
  it('renders the checklist only for the latest todos block', () => {
    const blocks = [
      {id: 'a', content: FIRST_TAG},
      {id: 'b', content: LATEST_TAG},
    ];
    render(
      <SeerTodosProvider blocks={blocks}>
        <SeerEmbedBlockContext value="a">
          <SeerMarkdown raw={FIRST_TAG} />
        </SeerEmbedBlockContext>
        <SeerEmbedBlockContext value="b">
          <SeerMarkdown raw={LATEST_TAG} />
        </SeerEmbedBlockContext>
      </SeerTodosProvider>
    );

    // Only the latest snapshot's items render — 'Write summary' is unique to it.
    expect(screen.getByText('Write summary')).toBeInTheDocument();
    // Items shared by both snapshots appear exactly once (older embed renders null).
    expect(screen.getAllByText('Investigate spans')).toHaveLength(1);
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
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
