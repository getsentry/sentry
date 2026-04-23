import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useConversations} from './useConversations';

const BASE_CONVERSATION = {
  conversationId: 'conv-1',
  duration: 1000,
  endTimestamp: 2000,
  errors: 0,
  llmCalls: 1,
  startTimestamp: 1000,
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

  it('normalizes firstInput when it is a string', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/ai-conversations/`,
      body: [{...BASE_CONVERSATION, firstInput: 'hello', lastOutput: null}],
    });

    const {result} = renderHookWithProviders(() => useConversations(), {organization});

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data[0]?.firstInput).toBe('hello');
  });

  it('normalizes firstInput from array format to string', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/ai-conversations/`,
      body: [
        {
          ...BASE_CONVERSATION,
          firstInput: [
            {type: 'image', text: 'ignore me'},
            {type: 'text', text: 'hello from array'},
          ],
          lastOutput: null,
        },
      ],
    });

    const {result} = renderHookWithProviders(() => useConversations(), {organization});

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data[0]?.firstInput).toBe('hello from array');
  });

  it('normalizes firstInput to null when array has no text type', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/ai-conversations/`,
      body: [
        {
          ...BASE_CONVERSATION,
          firstInput: [{type: 'image', text: 'no text type'}],
          lastOutput: null,
        },
      ],
    });

    const {result} = renderHookWithProviders(() => useConversations(), {organization});

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data[0]?.firstInput).toBeNull();
  });

  it('normalizes lastOutput when it is a string', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/ai-conversations/`,
      body: [{...BASE_CONVERSATION, firstInput: null, lastOutput: 'world'}],
    });

    const {result} = renderHookWithProviders(() => useConversations(), {organization});

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data[0]?.lastOutput).toBe('world');
  });

  it('normalizes lastOutput from array format to string', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/ai-conversations/`,
      body: [
        {
          ...BASE_CONVERSATION,
          firstInput: null,
          lastOutput: [
            {type: 'tool_use', text: 'ignore me'},
            {type: 'text', text: 'world from array'},
          ],
        },
      ],
    });

    const {result} = renderHookWithProviders(() => useConversations(), {organization});

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // This was the bug: lastOutput was passed through as an array, causing
    // `.replace is not a function` when rendering the table cell
    expect(result.current.data[0]?.lastOutput).toBe('world from array');
  });

  it('normalizes lastOutput to null when array has no text type', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/ai-conversations/`,
      body: [
        {
          ...BASE_CONVERSATION,
          firstInput: null,
          lastOutput: [{type: 'tool_use', text: 'no text type'}],
        },
      ],
    });

    const {result} = renderHookWithProviders(() => useConversations(), {organization});

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data[0]?.lastOutput).toBeNull();
  });

  it('handles null firstInput and lastOutput', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/ai-conversations/`,
      body: [{...BASE_CONVERSATION, firstInput: null, lastOutput: null}],
    });

    const {result} = renderHookWithProviders(() => useConversations(), {organization});

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data[0]?.firstInput).toBeNull();
    expect(result.current.data[0]?.lastOutput).toBeNull();
  });

  it('sorts conversations by endTimestamp descending', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/ai-conversations/`,
      body: [
        {...BASE_CONVERSATION, conversationId: 'older', endTimestamp: 1000},
        {...BASE_CONVERSATION, conversationId: 'newer', endTimestamp: 2000},
      ],
    });

    const {result} = renderHookWithProviders(() => useConversations(), {organization});

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.data[0]?.conversationId).toBe('newer');
    expect(result.current.data[1]?.conversationId).toBe('older');
  });
});
