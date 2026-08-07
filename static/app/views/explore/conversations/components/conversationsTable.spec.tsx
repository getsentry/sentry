import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {COL_WIDTH_MINIMUM} from 'sentry/components/tables/gridEditable';

import {
  collapseToolsColumnWhenUnused,
  ConversationsTable,
  getVisibleToolCount,
} from './conversationsTable';

const BASE_CONVERSATION = {
  conversationId: 'conv-1',
  endTimestamp: 2000,
  errors: 0,
  firstInput: null,
  generationDuration: 5000,
  lastOutput: null,
  inputTokens: 10,
  outputTokens: 20,
  llmCalls: 3,
  projectId: null,
  startTimestamp: 1000,
  title: null,
  toolCalls: 0,
  toolErrors: 0,
  toolNames: [],
  totalCost: null,
  totalTokens: 100,
  traceCount: 1,
  traceIds: ['trace-1'],
  user: null,
};

const organization = OrganizationFixture({
  features: ['gen-ai-conversations'],
});

function mockConversations(body: Array<Record<string, unknown>>) {
  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/ai-conversations/`,
    body,
  });
}

function renderTable() {
  return render(<ConversationsTable />, {organization});
}

describe('ConversationsTable', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    act(() => {
      PageFiltersStore.reset();
      PageFiltersStore.init();
    });
  });

  it('renders the AI-generated title when present', async () => {
    mockConversations([
      {
        ...BASE_CONVERSATION,
        title: 'Summarize Q2 revenue trends',
        firstInput: 'can you look at revenue',
      },
    ]);

    renderTable();

    expect(await screen.findByText('Summarize Q2 revenue trends')).toBeInTheDocument();
  });

  it('falls back to the first input message when there is no title', async () => {
    mockConversations([
      {...BASE_CONVERSATION, title: null, firstInput: 'Debug failing auth middleware'},
    ]);

    renderTable();

    expect(await screen.findByText('Debug failing auth middleware')).toBeInTheDocument();
  });

  it('flattens markdown and tags in the title to plain text', async () => {
    mockConversations([{...BASE_CONVERSATION, title: '# Summarize <b>Q2</b> revenue'}]);

    renderTable();

    expect(await screen.findByText('Summarize Q2 revenue')).toBeInTheDocument();
  });

  it('shows the placeholder when the first message flattens to nothing', async () => {
    mockConversations([{...BASE_CONVERSATION, title: null, firstInput: '```\n```'}]);

    renderTable();

    expect(await screen.findByText('Untitled conversation')).toBeInTheDocument();
  });

  it('renders the user identity', async () => {
    mockConversations([
      {
        ...BASE_CONVERSATION,
        title: 'A conversation',
        user: {
          id: '1',
          email: 'sarah@example.com',
          username: null,
          ip_address: null,
        },
      },
    ]);

    renderTable();

    expect(await screen.findByText('sarah@example.com')).toBeInTheDocument();
  });

  it('renders tool tags', async () => {
    mockConversations([
      {
        ...BASE_CONVERSATION,
        title: 'A conversation',
        toolNames: ['get_issue_details', 'execute_query'],
      },
    ]);

    renderTable();

    // Tags render both in the visible row and the hidden measurement layer, so
    // there is more than one match. Overflow math is layout-dependent and is
    // covered by the getVisibleToolCount unit tests below.
    expect((await screen.findAllByText('get_issue_details')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('execute_query').length).toBeGreaterThan(0);
  });

  it('keeps the tools column at full width when a conversation has tools', async () => {
    mockConversations([
      {...BASE_CONVERSATION, title: 'With tools', toolNames: ['execute_query']},
    ]);

    renderTable();

    await screen.findByText('With tools');

    // The tools column keeps its default 220px width in the grid template.
    expect(screen.getByTestId('grid-editable').style.gridTemplateColumns).toContain(
      '220px'
    );
  });

  it('collapses the tools column when no conversation has tools', async () => {
    mockConversations([{...BASE_CONVERSATION, title: 'No tools', toolNames: []}]);

    renderTable();

    await screen.findByText('No tools');

    // The default 220px tools width is dropped so the space goes to the
    // flexible conversation column.
    expect(screen.getByTestId('grid-editable').style.gridTemplateColumns).not.toContain(
      '220px'
    );
  });

  it('navigates to the conversation detail on row click', async () => {
    mockConversations([{...BASE_CONVERSATION, title: 'Open me'}]);

    const {router} = renderTable();

    await userEvent.click(await screen.findByText('Open me'));

    await waitFor(() => {
      expect(router.location.pathname).toContain('conv-1');
    });
  });

  it('opens the conversation in a new tab on cmd/ctrl+click', async () => {
    mockConversations([{...BASE_CONVERSATION, title: 'Open me'}]);

    const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);

    const user = userEvent.setup();
    const {router} = renderTable();
    const initialPath = router.location.pathname;

    // Hold both Meta (mac) and Control (other platforms) so the modifier is
    // detected regardless of the test platform. A single `user` instance is
    // required so the held keys carry into the click event.
    await user.keyboard('{Meta>}{Control>}');
    await user.click(await screen.findByText('Open me'));
    await user.keyboard('{/Control}{/Meta}');

    expect(openSpy).toHaveBeenCalledWith(expect.stringContaining('conv-1'), '_blank');
    // Modifier+click must not also navigate the current tab.
    expect(router.location.pathname).toBe(initialPath);

    openSpy.mockRestore();
  });

  it('opens the conversation in a new window on shift+click', async () => {
    mockConversations([{...BASE_CONVERSATION, title: 'Open me'}]);

    const openSpy = jest.spyOn(window, 'open').mockReturnValue(null);

    const user = userEvent.setup();
    const {router} = renderTable();
    const initialPath = router.location.pathname;

    await user.keyboard('{Shift>}');
    await user.click(await screen.findByText('Open me'));
    await user.keyboard('{/Shift}');

    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('conv-1'),
      '_blank',
      'noopener,noreferrer'
    );
    expect(router.location.pathname).toBe(initialPath);

    openSpy.mockRestore();
  });
});

describe('collapseToolsColumnWhenUnused', () => {
  const TOOLS_DEFAULT_WIDTH = 220;
  const columns = [
    {key: 'conversation' as const, name: 'Conversation', width: -1},
    {key: 'tools' as const, name: 'Tools', width: TOOLS_DEFAULT_WIDTH},
    {key: 'age' as const, name: 'Age', width: 110},
  ];
  const toolsWidth = (result: ReadonlyArray<{key: string; width?: number}>) =>
    result.find(column => column.key === 'tools')?.width;

  it('collapses the default-width tools column when there are no tools', () => {
    const result = collapseToolsColumnWhenUnused(columns, true);
    expect(toolsWidth(result)).toBe(COL_WIDTH_MINIMUM);
  });

  it('keeps the tools column at full width when there are tools', () => {
    const result = collapseToolsColumnWhenUnused(columns, false);
    expect(toolsWidth(result)).toBe(TOOLS_DEFAULT_WIDTH);
  });

  it('respects a user-resized tools column and does not collapse it', () => {
    const resized = columns.map(column =>
      column.key === 'tools' ? {...column, width: 420} : column
    );
    const result = collapseToolsColumnWhenUnused(resized, true);
    expect(toolsWidth(result)).toBe(420);
  });
});

describe('getVisibleToolCount', () => {
  // 5 tags of 40px each, 4px gap, and a 30px overflow badge.
  const tagWidths = [40, 40, 40, 40, 40];
  const badgeWidth = 30;
  const gap = 4;

  it('shows every tag when they all fit within the row budget', () => {
    // Two rows of ~500px each easily fit all five 40px tags.
    expect(
      getVisibleToolCount({tagWidths, badgeWidth, gap, containerWidth: 500, maxRows: 2})
    ).toBe(5);
  });

  it('reserves room for the overflow badge when tags spill past the rows', () => {
    // Each row holds two 40px tags (40 + 4 + 40 = 84 <= 100). Two rows hold
    // four, but the fifth tag would need a third row, so the badge takes the
    // last slot: 3 tags visible + "+2".
    const visible = getVisibleToolCount({
      tagWidths,
      badgeWidth,
      gap,
      containerWidth: 100,
      maxRows: 2,
    });
    expect(visible).toBe(3);
  });

  it('can collapse everything into the badge in a very narrow column', () => {
    // 20px only fits the 30px badge on its own — no tag fits alongside it.
    expect(
      getVisibleToolCount({tagWidths, badgeWidth, gap, containerWidth: 20, maxRows: 2})
    ).toBe(0);
  });
});
