import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {SpanFields} from 'sentry/views/insights/types';

import {useConversation} from './useConversation';

const BASE_SPAN = {
  'gen_ai.conversation.id': 'conv-123',
  parent_span: 'parent-1',
  'precise.finish_ts': 1000.5,
  'precise.start_ts': 1000,
  project: 'test-project',
  'project.id': 1,
  'span.name': 'gen_ai.generate',
  'span.status': 'ok',
  span_id: 'span-1',
  trace: 'trace-1',
  'gen_ai.operation.type': 'ai_client',
};

function envelope(
  spans: Array<Record<string, unknown>>,
  title: string | null = null
): Record<string, unknown> {
  return {
    conversationId: spans[0]?.['gen_ai.conversation.id'] ?? '',
    title,
    spans,
  };
}

describe('useConversation', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    act(() => {
      PageFiltersStore.reset();
      PageFiltersStore.init();
    });
  });

  it('returns empty nodes when conversationId is empty', () => {
    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: ''}),
      {organization}
    );

    expect(result.current.nodes).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.title).toBeNull();
  });

  it('returns the conversation title from the envelope', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-title/`,
      body: envelope(
        [{...BASE_SPAN, 'gen_ai.conversation.id': 'conv-title', span_id: 'span-title'}],
        'My great conversation'
      ),
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'conv-title'}),
      {organization}
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.title).toBe('My great conversation');
  });

  it('returns a null title when the envelope has none', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-123/`,
      body: envelope([BASE_SPAN]),
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'conv-123'}),
      {organization}
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.title).toBeNull();
  });

  it('maps gen_ai.input.messages to node attributes', async () => {
    const inputMessages = JSON.stringify([{role: 'user', content: 'Hello from input'}]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-123/`,
      body: envelope([
        {
          'gen_ai.conversation.id': 'conv-123',
          parent_span: 'parent-1',
          'precise.finish_ts': 1000.5,
          'precise.start_ts': 1000,
          project: 'test-project',
          'project.id': 1,
          'span.name': 'gen_ai.generate',
          'span.status': 'ok',
          span_id: 'span-1',
          trace: 'trace-1',
          'gen_ai.operation.type': 'ai_client',
          'gen_ai.input.messages': inputMessages,
          'gen_ai.request.messages': JSON.stringify([
            {role: 'user', content: 'Fallback message'},
          ]),
        },
      ]),
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'conv-123'}),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.nodes).toHaveLength(1);
    const node = result.current.nodes[0];
    const attrs = (node?.value as {additional_attributes?: Record<string, unknown>})
      .additional_attributes;
    expect(attrs?.[SpanFields.GEN_AI_INPUT_MESSAGES]).toBe(inputMessages);
  });

  it('maps gen_ai.output.messages to node attributes', async () => {
    const outputMessages = JSON.stringify([
      {role: 'assistant', content: 'Hello from output'},
    ]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-output/`,
      body: envelope([
        {
          'gen_ai.conversation.id': 'conv-output',
          parent_span: 'parent-1',
          'precise.finish_ts': 1000.5,
          'precise.start_ts': 1000,
          project: 'test-project',
          'project.id': 1,
          'span.name': 'gen_ai.generate',
          'span.status': 'ok',
          span_id: 'span-output',
          trace: 'trace-output',
          'gen_ai.operation.type': 'ai_client',
          'gen_ai.output.messages': outputMessages,
        },
      ]),
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'conv-output'}),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.nodes).toHaveLength(1);
    const node = result.current.nodes[0];
    const attrs = (node?.value as {additional_attributes?: Record<string, unknown>})
      .additional_attributes;
    expect(attrs?.[SpanFields.GEN_AI_OUTPUT_MESSAGES]).toBe(outputMessages);
  });

  it('preserves span.op for an embeddings span without changing its op type', async () => {
    // gen_ai.operation.type is a closed enum with no "embeddings" bucket, so an
    // embeddings call reports "ai_client". We keep that op type (so the timeline
    // renders it unchanged) and preserve span.op, which the transcript uses to
    // recognize the embedding.
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-embedding/`,
      body: envelope([
        {
          'gen_ai.conversation.id': 'conv-embedding',
          parent_span: 'parent-1',
          'precise.finish_ts': 1000.5,
          'precise.start_ts': 1000,
          project: 'test-project',
          'project.id': 1,
          'span.name': 'embeddings Google Embedding',
          'span.op': 'gen_ai.embeddings',
          'span.status': 'ok',
          span_id: 'span-embedding',
          trace: 'trace-embedding',
          'gen_ai.operation.type': 'ai_client',
          'gen_ai.response.model': 'text-embedding-005',
        },
      ]),
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'conv-embedding'}),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.nodes).toHaveLength(1);
    const node = result.current.nodes[0];
    const attrs = (node?.value as {additional_attributes?: Record<string, unknown>})
      .additional_attributes;
    expect(attrs?.[SpanFields.SPAN_OP]).toBe('gen_ai.embeddings');
    expect(attrs?.[SpanFields.GEN_AI_OPERATION_TYPE]).toBe('ai_client');
  });

  it('maps gen_ai.embeddings.input to node attributes', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-embedding-input/`,
      body: envelope([
        {
          'gen_ai.conversation.id': 'conv-embedding-input',
          parent_span: 'parent-1',
          'precise.finish_ts': 1000.5,
          'precise.start_ts': 1000,
          project: 'test-project',
          'project.id': 1,
          'span.name': 'embeddings Google Embedding',
          'span.op': 'gen_ai.embeddings',
          'span.status': 'ok',
          span_id: 'span-embedding',
          trace: 'trace-embedding',
          'gen_ai.operation.type': 'ai_client',
          'gen_ai.embeddings.input': 'search query text',
        },
      ]),
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'conv-embedding-input'}),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.nodes).toHaveLength(1);
    const node = result.current.nodes[0];
    const attrs = (node?.value as {additional_attributes?: Record<string, unknown>})
      .additional_attributes;
    expect(attrs?.[SpanFields.GEN_AI_EMBEDDINGS_INPUT]).toBe('search query text');
  });

  it('maps gen_ai.request.messages to node attributes', async () => {
    const requestMessages = JSON.stringify([
      {role: 'user', content: 'Hello from request'},
    ]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-456/`,
      body: envelope([
        {
          'gen_ai.conversation.id': 'conv-456',
          parent_span: 'parent-1',
          'precise.finish_ts': 1000.5,
          'precise.start_ts': 1000,
          project: 'test-project',
          'project.id': 1,
          'span.name': 'gen_ai.generate',
          'span.status': 'ok',
          span_id: 'span-2',
          trace: 'trace-2',
          'gen_ai.operation.type': 'ai_client',
          'gen_ai.request.messages': requestMessages,
        },
      ]),
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'conv-456'}),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.nodes).toHaveLength(1);
    const node = result.current.nodes[0];
    const attrs = (node?.value as {additional_attributes?: Record<string, unknown>})
      .additional_attributes;
    expect(attrs?.[SpanFields.GEN_AI_REQUEST_MESSAGES]).toBe(requestMessages);
  });

  it('uses empty string for missing optional fields', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-789/`,
      body: envelope([
        {
          'gen_ai.conversation.id': 'conv-789',
          parent_span: 'parent-1',
          'precise.finish_ts': 1000.5,
          'precise.start_ts': 1000,
          project: 'test-project',
          'project.id': 1,
          'span.name': 'gen_ai.generate',
          'span.status': 'ok',
          span_id: 'span-3',
          trace: 'trace-3',
          'gen_ai.operation.type': 'ai_client',
          // No input or request messages provided
        },
      ]),
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'conv-789'}),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.nodes).toHaveLength(1);
    const node = result.current.nodes[0];
    const attrs = (node?.value as {additional_attributes?: Record<string, unknown>})
      .additional_attributes;
    // Should default to empty string for missing fields
    expect(attrs?.[SpanFields.GEN_AI_INPUT_MESSAGES]).toBe('');
    expect(attrs?.[SpanFields.GEN_AI_REQUEST_MESSAGES]).toBe('');
  });

  it('uses conversation timestamps when provided', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-timestamps/`,
      body: envelope([
        {
          'gen_ai.conversation.id': 'conv-timestamps',
          parent_span: 'parent-1',
          'precise.finish_ts': 1000.5,
          'precise.start_ts': 1000,
          project: 'test-project',
          'project.id': 1,
          'span.name': 'gen_ai.generate',
          'span.status': 'ok',
          span_id: 'span-ts',
          trace: 'trace-ts',
          'gen_ai.operation.type': 'ai_client',
        },
      ]),
    });

    const startTimestamp = 1700000000000; // Nov 14, 2023
    const endTimestamp = 1700100000000; // ~1.16 days later

    const {result} = renderHookWithProviders(
      () =>
        useConversation({
          conversationId: 'conv-timestamps',
          startTimestamp,
          endTimestamp,
        }),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Verify the API was called with correct timestamps (with 1-hour padding)
    // and ALL_ACCESS_PROJECTS (-1) when no project is selected in page filters
    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/agents/conversations/conv-timestamps/'),
      expect.objectContaining({
        query: expect.objectContaining({
          start: new Date(startTimestamp - 60 * 60 * 1000).toISOString(),
          end: new Date(endTimestamp + 60 * 60 * 1000).toISOString(),
          project: [-1],
        }),
      })
    );

    // Ensure environment is not included in the query when using conversation timestamps
    const queryArg = mockRequest.mock.calls[0]![1]!.query;
    expect(queryArg).not.toHaveProperty('environment');
  });

  it('uses span.name for description and name fields', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-name/`,
      body: envelope([
        {
          'gen_ai.conversation.id': 'conv-name',
          parent_span: 'parent-1',
          'precise.finish_ts': 1000.5,
          'precise.start_ts': 1000,
          project: 'test-project',
          'project.id': 1,
          'span.name': 'My AI Agent',
          'span.status': 'ok',
          span_id: 'span-name',
          trace: 'trace-name',
          'gen_ai.operation.type': 'ai_client',
        },
      ]),
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'conv-name'}),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.nodes).toHaveLength(1);
    const node = result.current.nodes[0];
    const value = node?.value as {description?: string; name?: string};
    expect(value?.description).toBe('My AI Agent');
    expect(value?.name).toBe('My AI Agent');
  });

  it('sorts nodes by start timestamp for AI spans list', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-sort/`,
      body: envelope([
        {
          'gen_ai.conversation.id': 'conv-sort',
          parent_span: 'parent-1',
          'precise.finish_ts': 1002,
          'precise.start_ts': 1001,
          project: 'test-project',
          'project.id': 1,
          'span.name': 'Second by start, first by end',
          'span.status': 'ok',
          span_id: 'span-b',
          trace: 'trace-sort',
          'gen_ai.operation.type': 'ai_client',
        },
        {
          'gen_ai.conversation.id': 'conv-sort',
          parent_span: 'parent-1',
          'precise.finish_ts': 1003,
          'precise.start_ts': 1000,
          project: 'test-project',
          'project.id': 1,
          'span.name': 'First by start, second by end',
          'span.status': 'ok',
          span_id: 'span-a',
          trace: 'trace-sort',
          'gen_ai.operation.type': 'ai_client',
        },
      ]),
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'conv-sort'}),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.nodes).toHaveLength(2);
    // Sorted by start timestamp: span-a (1000) before span-b (1001)
    expect(result.current.nodes[0]?.id).toBe('span-a');
    expect(result.current.nodes[1]?.id).toBe('span-b');
  });

  it('uses project from page filters, not hardcoded -1', async () => {
    act(() => PageFiltersStore.updateProjects([456], []));

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-123/`,
      body: envelope([BASE_SPAN]),
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'conv-123'}),
      {organization}
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/agents/conversations/conv-123/'),
      expect.objectContaining({
        query: expect.objectContaining({project: [456]}),
      })
    );
  });

  it('uses page filter datetime when no conversation timestamps are provided', async () => {
    act(() =>
      PageFiltersStore.updateDateTime({
        period: null,
        start: '2026-04-01T00:00:00',
        end: '2026-04-07T00:00:00',
        utc: null,
      })
    );

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-123/`,
      body: envelope([BASE_SPAN]),
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'conv-123'}),
      {organization}
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/agents/conversations/conv-123/'),
      expect.objectContaining({
        query: expect.objectContaining({
          start: expect.stringContaining('2026-04-01'),
          end: expect.stringContaining('2026-04-07'),
        }),
      })
    );
    // statsPeriod must not be present when explicit dates are set
    const queryArg = mockRequest.mock.calls[0]![1]!.query;
    expect(queryArg).not.toHaveProperty('statsPeriod');
  });

  it('falls back to ALL_ACCESS_PROJECTS with no time params when no filters are set', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-123/`,
      body: envelope([BASE_SPAN]),
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'conv-123'}),
      {organization}
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/agents/conversations/conv-123/'),
      expect.objectContaining({
        query: expect.objectContaining({
          project: [-1],
        }),
      })
    );
    // No statsPeriod sent — backend uses its 30d retention fallback
    const queryArg = mockRequest.mock.calls[0]![1]!.query;
    expect(queryArg).not.toHaveProperty('statsPeriod');
    expect(queryArg).not.toHaveProperty('start');
    expect(queryArg).not.toHaveProperty('end');
  });

  it('uses relative period from page filters when explicitly set', async () => {
    act(() =>
      PageFiltersStore.updateDateTime({
        period: '7d',
        start: null,
        end: null,
        utc: null,
      })
    );

    const mockRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-123/`,
      body: envelope([BASE_SPAN]),
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'conv-123'}),
      {organization}
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(mockRequest).toHaveBeenCalledWith(
      expect.stringContaining('/agents/conversations/conv-123/'),
      expect.objectContaining({
        query: expect.objectContaining({
          statsPeriod: '7d',
        }),
      })
    );
    const queryArg = mockRequest.mock.calls[0]![1]!.query;
    expect(queryArg).not.toHaveProperty('start');
    expect(queryArg).not.toHaveProperty('end');
  });

  it('filters to only gen_ai spans', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-filter/`,
      body: envelope([
        {
          'gen_ai.conversation.id': 'conv-filter',
          parent_span: 'parent-1',
          'precise.finish_ts': 1000.5,
          'precise.start_ts': 1000,
          project: 'test-project',
          'project.id': 1,
          'span.name': 'gen_ai.generate',
          'span.status': 'ok',
          span_id: 'span-ai',
          trace: 'trace-1',
          'gen_ai.operation.type': 'ai_client',
        },
        {
          'gen_ai.conversation.id': 'conv-filter',
          parent_span: 'parent-1',
          'precise.finish_ts': 1001.5,
          'precise.start_ts': 1001,
          project: 'test-project',
          'project.id': 1,
          'span.name': 'http.client',
          'span.status': 'ok',
          span_id: 'span-http',
          trace: 'trace-1',
          // No gen_ai.operation.type - should be filtered out
        },
      ]),
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'conv-filter'}),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // Only the gen_ai span should be included
    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0]?.id).toBe('span-ai');
  });

  it('maps errors and occurrences from the response onto the node', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-issues/`,
      body: envelope([
        {
          ...BASE_SPAN,
          'gen_ai.conversation.id': 'conv-issues',
          span_id: 'span-issues',
          errors: [
            {
              event_id: 'error-1',
              event_type: 'error',
              issue_id: 111,
              level: 'error',
              project_id: 1,
              project_slug: 'test-project',
              start_timestamp: 1000,
              transaction: 'gen_ai.generate',
            },
          ],
          occurrences: [
            {
              event_id: 'occurrence-1',
              event_type: 'occurrence',
              issue_id: 222,
              issue_type: 1001,
              level: 'info',
              culprit: 'culprit',
              description: 'Slow thing',
              project_id: 1,
              project_slug: 'test-project',
              start_timestamp: 1000,
              transaction: 'gen_ai.generate',
            },
          ],
        },
      ]),
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'conv-issues'}),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const node = result.current.nodes[0];
    expect(node?.uniqueErrorIssues.map(issue => issue.issue_id)).toEqual([111]);
    expect(node?.uniqueOccurrenceIssues.map(issue => issue.issue_id)).toEqual([222]);
    expect(node?.uniqueIssues.map(issue => issue.issue_id)).toEqual([111, 222]);
  });

  it('defaults to no issues when the response omits errors and occurrences', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/conv-no-issues/`,
      body: envelope([
        {...BASE_SPAN, 'gen_ai.conversation.id': 'conv-no-issues', span_id: 'span-x'},
      ]),
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'conv-no-issues'}),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const node = result.current.nodes[0];
    expect(node?.uniqueIssues).toEqual([]);
    expect(node?.uniqueErrorIssues).toEqual([]);
    expect(node?.uniqueOccurrenceIssues).toEqual([]);
  });
});
