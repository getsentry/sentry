import {act, screen, userEvent, waitFor, within} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {
  getEmbedLinkHref,
  renderEmbed,
} from 'sentry/components/seer/markdown/embeds/components/resourceEmbedTestUtils';

const CONVERSATION_ID = 'conv-1';
const LIST_URL = '/organizations/org-slug/agents/conversations/';
const DETAIL_URL = `/organizations/org-slug/agents/conversations/${CONVERSATION_ID}/`;

/** Shaped as the conversation detail endpoint returns it: flat spans. */
function spanFixture(overrides: Record<string, unknown>) {
  return {
    'gen_ai.conversation.id': CONVERSATION_ID,
    parent_span: 'parent-1',
    project: 'test-project',
    'project.id': 1,
    'span.status': 'ok',
    trace: 'trace-1',
    'gen_ai.operation.type': 'ai_client',
    ...overrides,
  };
}

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

describe('Seer conversation embeds', () => {
  beforeAll(async () => {
    // Both blocks are behind `lazy()`. Compiling the transcript's module graph
    // on first render costs more than a `findBy*` will wait for, so pay it
    // here instead of inside the first block assertion.
    await import('./conversationBlock');
    await import('./conversationsQueryBlock');
  }, 60_000);

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    act(() => {
      PageFiltersStore.reset();
      PageFiltersStore.init();
    });
  });

  describe('conversation', () => {
    it('links to the conversation detail view inline', () => {
      const href = getEmbedLinkHref('conversation', 'Refund request escalated', {
        id: CONVERSATION_ID,
        title: 'Refund request escalated',
        projects: ['1'],
        start: '2026-08-25T16:37:12Z',
        end: '2026-08-25T16:39:02Z',
      });

      expect(href.split('?')[0]).toBe(
        `/organizations/org-slug/explore/agents/conversations/${CONVERSATION_ID}/`
      );
      const params = searchParams(href);
      // The detail view scopes its span query to this window, so it is padded
      // an hour either side of the conversation's own timestamps.
      expect(params.get('start')).toBe('2026-08-25T15:37:12.000Z');
      expect(params.get('end')).toBe('2026-08-25T17:39:02.000Z');
      expect(params.getAll('project')).toEqual(['1']);
      expect(params.get('referrer')).toBe('seer-conversation-embed');
    });

    it('falls back to the id when the tag carries no title', () => {
      const href = getEmbedLinkHref('conversation', `Conversation ${CONVERSATION_ID}`, {
        id: CONVERSATION_ID,
      });

      expect(href).toBe(
        `/organizations/org-slug/explore/agents/conversations/${CONVERSATION_ID}/?referrer=seer-conversation-embed`
      );
    });

    it('renders the transcript and the aggregates', async () => {
      const request = MockApiClient.addMockResponse({
        url: DETAIL_URL,
        body: {
          conversationId: CONVERSATION_ID,
          title: 'Out of memory investigation',
          spans: [
            spanFixture({
              span_id: 'span-a',
              'span.name': 'first turn',
              'precise.start_ts': 1000,
              'precise.finish_ts': 1000.5,
              'gen_ai.request.messages': JSON.stringify([
                {role: 'user', content: 'Why did the job fail?'},
              ]),
              'gen_ai.response.text': 'The worker ran out of memory.',
              'gen_ai.usage.total_tokens': 1200,
            }),
          ],
        },
      });

      renderEmbed({
        name: 'conversation',
        data: {
          id: CONVERSATION_ID,
          title: 'Stale title',
          start: '2026-08-25T16:37:12Z',
          end: '2026-08-25T16:39:02Z',
        },
      });

      expect(
        await screen.findByText('The worker ran out of memory.')
      ).toBeInTheDocument();
      expect(screen.getByText('Why did the job fail?')).toBeInTheDocument();
      expect(screen.getByText('LLM Calls')).toBeInTheDocument();
      expect(screen.getByText('Tokens')).toBeInTheDocument();
      // The API title wins over whatever the model wrote into the tag.
      expect(
        screen.getByRole('link', {name: 'Out of memory investigation'})
      ).toBeInTheDocument();
      expect(screen.queryByText('Stale title')).not.toBeInTheDocument();

      await waitFor(() => {
        expect(request).toHaveBeenCalledWith(
          DETAIL_URL,
          expect.objectContaining({
            query: expect.objectContaining({
              // The tag's ISO timestamps scope the query instead of the
              // default page-filter window.
              start: '2026-08-25T15:37:12.000Z',
              end: '2026-08-25T17:39:02.000Z',
            }),
          })
        );
      });
    });

    it('keeps message selection inside the embed', async () => {
      MockApiClient.addMockResponse({
        url: DETAIL_URL,
        body: {
          conversationId: CONVERSATION_ID,
          title: null,
          spans: [
            spanFixture({
              span_id: 'span-a',
              'span.name': 'first turn',
              'precise.start_ts': 1000,
              'precise.finish_ts': 1000.5,
              'gen_ai.request.messages': JSON.stringify([
                {role: 'user', content: 'Why did the job fail?'},
              ]),
              'gen_ai.response.text': 'The worker ran out of memory.',
            }),
          ],
        },
      });

      const {router} = renderEmbed({
        name: 'conversation',
        data: {id: CONVERSATION_ID},
      });
      const initialLocation = router.location;

      await userEvent.click(await screen.findByText('The worker ran out of memory.'));

      // Selecting a message is embed-local state: it must not touch the host
      // page's URL (see the embeds README).
      expect(router.location.pathname).toBe(initialLocation.pathname);
      expect(router.location.query).toEqual(initialLocation.query);
    });

    it('shows an error when the conversation cannot be loaded', async () => {
      MockApiClient.addMockResponse({url: DETAIL_URL, statusCode: 500, body: {}});

      renderEmbed({name: 'conversation', data: {id: CONVERSATION_ID}});

      expect(await screen.findByText('Unable to load conversation.')).toBeInTheDocument();
    });
  });

  describe('conversationsQuery', () => {
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
      expect(request.mock.calls[0][1].query.query).toContain(
        'gen_ai.request.model:gpt-4o'
      );
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
});
