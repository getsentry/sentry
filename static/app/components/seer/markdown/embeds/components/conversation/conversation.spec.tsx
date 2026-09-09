import {act, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {
  getEmbedLinkHref,
  renderEmbed,
} from 'sentry/components/seer/markdown/embeds/components/resourceEmbedTestUtils';

const CONVERSATION_ID = 'conv-1';
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

function searchParams(href: string) {
  return new URLSearchParams(href.split('?')[1] ?? '');
}

describe('conversation embed', () => {
  beforeAll(async () => {
    // The block is behind `lazy()`. Compiling its module graph on first render
    // costs more than a `findBy*` will wait for, so pay it here instead of
    // inside the first block assertion.
    await import('./conversationBlock');
  }, 60_000);

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    act(() => {
      PageFiltersStore.reset();
      PageFiltersStore.init();
    });
  });

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

  it('renders the aggregates but not the transcript', async () => {
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

    // The aggregates bar renders its labels while loading too, so the API
    // title -- which only arrives with the response -- is the loaded signal.
    // The API title also wins over whatever the model wrote into the tag.
    expect(
      await screen.findByRole('link', {name: 'Out of memory investigation'})
    ).toBeInTheDocument();
    expect(screen.queryByText('Stale title')).not.toBeInTheDocument();

    expect(screen.getByText('LLM Calls')).toBeInTheDocument();
    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Tokens')).toBeInTheDocument();
    expect(screen.getByText('Cost')).toBeInTheDocument();

    // The embed renders inside an agent conversation, so it deliberately shows
    // the totals only -- a nested transcript reads as part of the answer.
    expect(screen.queryByText('The worker ran out of memory.')).not.toBeInTheDocument();
    expect(screen.queryByText('Why did the job fail?')).not.toBeInTheDocument();

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

  it('shows an error when the conversation cannot be loaded', async () => {
    MockApiClient.addMockResponse({url: DETAIL_URL, statusCode: 500, body: {}});

    renderEmbed({name: 'conversation', data: {id: CONVERSATION_ID}});

    expect(await screen.findByText('Unable to load conversation.')).toBeInTheDocument();
  });
});
