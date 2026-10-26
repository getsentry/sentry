import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useConversations, type Conversation} from './useConversations';

const BASE_CONVERSATION: Conversation = {
  conversationId: 'conv-1',
  endTimestamp: 2000,
  errors: 0,
  firstInput: null,
  generationDuration: 0,
  inputTokens: 0,
  lastOutput: null,
  llmCalls: 1,
  outputTokens: 0,
  projectId: null,
  startTimestamp: 1000,
  timeSpan: 1000,
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

describe('useConversations', () => {
  const organization = OrganizationFixture({
    features: ['gen-ai-conversations'],
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('requests 50 conversations per page', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/`,
      body: [],
      match: [MockApiClient.matchQuery({per_page: 50})],
    });

    const {result} = renderHookWithProviders(() => useConversations(), {organization});

    await waitFor(() => expect(result.current.isFetching).toBe(false));
  });

  it('preserves string firstInput', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/`,
      body: [{...BASE_CONVERSATION, firstInput: 'hello', lastOutput: null}],
    });

    const {result} = renderHookWithProviders(() => useConversations(), {organization});

    await waitFor(() => expect(result.current.isFetching).toBe(false));

    expect(result.current.data[0]?.firstInput).toBe('hello');
  });

  it('preserves string lastOutput', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/`,
      body: [{...BASE_CONVERSATION, firstInput: null, lastOutput: 'world'}],
    });

    const {result} = renderHookWithProviders(() => useConversations(), {organization});

    await waitFor(() => expect(result.current.isFetching).toBe(false));

    expect(result.current.data[0]?.lastOutput).toBe('world');
  });

  it('handles null firstInput and lastOutput', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/`,
      body: [{...BASE_CONVERSATION, firstInput: null, lastOutput: null}],
    });

    const {result} = renderHookWithProviders(() => useConversations(), {organization});

    await waitFor(() => expect(result.current.isFetching).toBe(false));

    expect(result.current.data[0]?.firstInput).toBeNull();
    expect(result.current.data[0]?.lastOutput).toBeNull();
  });

  it('preserves the server sort order', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/`,
      body: [
        {...BASE_CONVERSATION, conversationId: 'older', endTimestamp: 1000},
        {...BASE_CONVERSATION, conversationId: 'newer', endTimestamp: 2000},
      ],
    });

    const {result} = renderHookWithProviders(() => useConversations(), {organization});

    await waitFor(() => expect(result.current.isFetching).toBe(false));

    expect(result.current.data[0]?.conversationId).toBe('older');
    expect(result.current.data[1]?.conversationId).toBe('newer');
  });

  it('reports a direct hit when the header is present', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/`,
      body: [{...BASE_CONVERSATION, firstInput: null, lastOutput: null}],
      headers: {'X-Sentry-Direct-Hit': '1'},
    });

    const {result} = renderHookWithProviders(() => useConversations(), {organization});

    await waitFor(() => expect(result.current.isFetching).toBe(false));

    expect(result.current.isDirectHit).toBe(true);
  });

  it('does not report a direct hit when the header is absent', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/`,
      body: [{...BASE_CONVERSATION, firstInput: null, lastOutput: null}],
    });

    const {result} = renderHookWithProviders(() => useConversations(), {organization});

    await waitFor(() => expect(result.current.isFetching).toBe(false));

    expect(result.current.isDirectHit).toBe(false);
  });

  it('adds the errors filter when errorsOnly is set', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/`,
      body: [],
      match: [
        MockApiClient.matchQuery({
          query: '(conversation.errors:>0) and (gen_ai.tool.name:search)',
        }),
      ],
    });

    const {result} = renderHookWithProviders(() => useConversations(), {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/',
          query: {errorsOnly: 'true', query: 'gen_ai.tool.name:search'},
        },
      },
    });

    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(request).toHaveBeenCalled();
  });

  it('does not add the errors filter by default', async () => {
    const request = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/agents/conversations/`,
      body: [],
      match: [MockApiClient.matchQuery({query: ''})],
    });

    const {result} = renderHookWithProviders(() => useConversations(), {organization});

    await waitFor(() => expect(result.current.isFetching).toBe(false));
    expect(request).toHaveBeenCalled();
  });
});
