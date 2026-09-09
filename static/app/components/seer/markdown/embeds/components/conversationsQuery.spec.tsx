import {act, screen, waitFor, within} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {
  getEmbedLinkHref,
  renderEmbed,
} from 'sentry/components/seer/markdown/embeds/components/resourceEmbedTestUtils';

const LIST_URL = '/organizations/org-slug/agents/conversations/';

/** Shaped as the list endpoint returns it: `firstInput` may be content parts. */
function conversationFixture(overrides: Record<string, unknown> = {}) {
  return {
    conversationId: '8f0e1f6a-1f2b-4d3c-9e5a-0b1c2d3e4f5a',
    title: 'Refund request escalated',
    firstInput: [{type: 'text', text: 'I want a refund'}],
    lastOutput: 'Escalating to a human',
    duration: 120_000,
    generationDuration: 4200,
    llmCalls: 3,
    toolCalls: 2,
    toolErrors: 0,
    toolNames: ['search'],
    errors: 1,
    inputTokens: 100,
    outputTokens: 200,
    totalTokens: 300,
    totalCost: 0.42,
    startTimestamp: 1_700_000_000_000,
    endTimestamp: 1_700_000_120_000,
    traceCount: 1,
    traceIds: ['trace-1'],
    projectId: 1,
    user: {email: 'user@example.com', id: '1', ip_address: null, username: null},
    ...overrides,
  };
}

function searchParams(href: string) {
  return new URLSearchParams(href.split('?')[1] ?? '');
}

describe('conversationsQuery embed', () => {
  beforeAll(async () => {
    // The block is behind `lazy()`; compile its module graph up front rather
    // than inside the first `findBy*`.
    await import('./conversationsQueryBlock');
  }, 60_000);

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    act(() => {
      PageFiltersStore.reset();
      PageFiltersStore.init();
    });
  });

  it('links to the agents list inline', () => {
    const href = getEmbedLinkHref('conversationsQuery', 'Conversations using tools', {
      query: 'gen_ai.tool.name:*',
      statsPeriod: '24h',
      projects: ['1', '2'],
      environments: ['prod'],
      agents: ['support-bot', 'triage-bot'],
      title: 'Conversations using tools',
    });

    expect(href.split('?')[0]).toBe('/organizations/org-slug/explore/agents/');
    const params = searchParams(href);
    expect(params.get('query')).toBe('gen_ai.tool.name:*');
    expect(params.get('statsPeriod')).toBe('24h');
    expect(params.getAll('project')).toEqual(['1', '2']);
    expect(params.getAll('environment')).toEqual(['prod']);
    // The list reads `agent` as one comma-separated value.
    expect(params.get('agent')).toBe('support-bot,triage-bot');
    expect(params.get('referrer')).toBe('seer-conversations-query-embed');
  });

  it('falls back to a generic title', () => {
    const href = getEmbedLinkHref('conversationsQuery', 'Conversation search', {
      query: '',
    });

    expect(href).toContain('/organizations/org-slug/explore/agents/');
  });

  it('previews matching conversations', async () => {
    const request = MockApiClient.addMockResponse({
      url: LIST_URL,
      body: [
        conversationFixture({
          conversationId: 'older',
          title: 'Older conversation',
          endTimestamp: 1_600_000_000_000,
        }),
        conversationFixture(),
      ],
    });

    renderEmbed({
      name: 'conversationsQuery',
      data: {
        query: 'gen_ai.request.model:gpt-4o',
        statsPeriod: '24h',
        agents: ['support-bot'],
      },
    });

    expect(await screen.findByText('Refund request escalated')).toBeInTheDocument();

    const row = screen.getByRole('row', {name: /Refund request escalated/});
    // A UUID id is shown as a short prefix.
    expect(within(row).getByText('8f0e1f6a')).toBeInTheDocument();
    expect(within(row).getByText('user@example.com')).toBeInTheDocument();
    expect(within(row).getByText('3')).toBeInTheDocument();
    expect(within(row).getByText('1')).toBeInTheDocument();
    expect(within(row).getByText('$0.42')).toBeInTheDocument();

    // Newest-first, the way the list view orders its rows.
    const rows = screen.getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Refund request escalated');
    expect(rows[2]).toHaveTextContent('Older conversation');

    await waitFor(() => {
      expect(request).toHaveBeenCalledWith(
        LIST_URL,
        expect.objectContaining({
          query: expect.objectContaining({
            // The agent filter is a URL param on the list view, but part of
            // the span query when the endpoint is called directly.
            query: expect.stringContaining('support-bot'),
            statsPeriod: '24h',
            per_page: 5,
          }),
        })
      );
    });
    expect(request.mock.calls[0][1].query.query).toContain('gen_ai.request.model:gpt-4o');
  });

  it('links each row to its conversation in a new tab', async () => {
    MockApiClient.addMockResponse({url: LIST_URL, body: [conversationFixture()]});

    renderEmbed({name: 'conversationsQuery', data: {query: ''}});

    const link = await screen.findByRole('link', {name: 'Refund request escalated'});

    // A new tab keeps the answer the embed is rendered into on screen.
    expect(link).toHaveAttribute('target', '_blank');
    const href = link.getAttribute('href') ?? '';
    expect(href.split('?')[0]).toBe(
      '/organizations/org-slug/explore/agents/conversations/8f0e1f6a-1f2b-4d3c-9e5a-0b1c2d3e4f5a/'
    );
    const params = searchParams(href);
    // The row's own timestamps, padded the same hour the detail view expects.
    expect(params.get('start')).toBe('2023-11-14T21:13:20.000Z');
    expect(params.get('end')).toBe('2023-11-14T23:15:20.000Z');
    expect(params.getAll('project')).toEqual(['1']);
    expect(params.get('referrer')).toBe('seer-conversations-query-embed');
  });

  it('flattens a content-part first input when there is no title', async () => {
    MockApiClient.addMockResponse({
      url: LIST_URL,
      body: [conversationFixture({title: null})],
    });

    renderEmbed({name: 'conversationsQuery', data: {query: ''}});

    expect(await screen.findByText('I want a refund')).toBeInTheDocument();
  });

  it('shows an empty state when nothing matches', async () => {
    MockApiClient.addMockResponse({url: LIST_URL, body: []});

    renderEmbed({name: 'conversationsQuery', data: {query: 'gen_ai.tool.name:*'}});

    expect(await screen.findByText('No matching conversations')).toBeInTheDocument();
  });
});
