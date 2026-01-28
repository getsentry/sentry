import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {SpanFields} from 'sentry/views/insights/types';

import {useConversation} from './useConversation';

describe('useConversation', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: [1]}), true);
  });

  it('maps gen_ai.input.messages from API response to node attributes', async () => {
    const inputMessages = JSON.stringify([
      {role: 'system', content: 'You are a helpful assistant.'},
      {role: 'user', content: [{type: 'text', text: 'Hello'}]},
    ]);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/ai-conversations/test-conversation/',
      body: [
        {
          span_id: 'span-1',
          trace: 'trace-1',
          parent_span: 'parent-1',
          'precise.start_ts': 1000,
          'precise.finish_ts': 1001,
          project: 'test-project',
          'project.id': 1,
          'span.description': 'Test span',
          'span.op': 'gen_ai.stream_text',
          'span.status': 'ok',
          'gen_ai.conversation.id': 'test-conversation',
          'gen_ai.operation.type': 'ai_client',
          'gen_ai.input.messages': inputMessages,
          'gen_ai.response.text': 'Hello back!',
        },
      ],
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'test-conversation'}),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0]?.attributes?.[SpanFields.GEN_AI_INPUT_MESSAGES]).toBe(
      inputMessages
    );
  });

  it('maps gen_ai.output.messages from API response to node attributes', async () => {
    const outputMessages = JSON.stringify([
      {role: 'assistant', content: 'Response from output messages'},
    ]);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/ai-conversations/test-conversation/',
      body: [
        {
          span_id: 'span-1',
          trace: 'trace-1',
          parent_span: 'parent-1',
          'precise.start_ts': 1000,
          'precise.finish_ts': 1001,
          project: 'test-project',
          'project.id': 1,
          'span.description': 'Test span',
          'span.op': 'gen_ai.stream_text',
          'span.status': 'ok',
          'gen_ai.conversation.id': 'test-conversation',
          'gen_ai.operation.type': 'ai_client',
          'gen_ai.output.messages': outputMessages,
        },
      ],
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'test-conversation'}),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0]?.attributes?.[SpanFields.GEN_AI_OUTPUT_MESSAGES]).toBe(
      outputMessages
    );
  });

  it('maps all gen_ai fields correctly', async () => {
    const inputMessages = JSON.stringify([{role: 'user', content: 'Hello'}]);
    const outputMessages = JSON.stringify([{role: 'assistant', content: 'Hi'}]);
    const requestMessages = JSON.stringify([{role: 'user', content: 'Request'}]);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/ai-conversations/test-conversation/',
      body: [
        {
          span_id: 'span-1',
          trace: 'trace-1',
          parent_span: 'parent-1',
          'precise.start_ts': 1000,
          'precise.finish_ts': 1001,
          project: 'test-project',
          'project.id': 1,
          'span.description': 'Test span',
          'span.op': 'gen_ai.stream_text',
          'span.status': 'ok',
          'gen_ai.conversation.id': 'test-conversation',
          'gen_ai.operation.type': 'ai_client',
          'gen_ai.input.messages': inputMessages,
          'gen_ai.output.messages': outputMessages,
          'gen_ai.request.messages': requestMessages,
          'gen_ai.response.text': 'Response text',
          'gen_ai.response.object': '{"key": "value"}',
          'gen_ai.tool.name': 'test-tool',
          'user.email': 'test@example.com',
        },
      ],
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'test-conversation'}),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const nodeAttributes = result.current.nodes[0]?.attributes;
    expect(nodeAttributes?.[SpanFields.GEN_AI_INPUT_MESSAGES]).toBe(inputMessages);
    expect(nodeAttributes?.[SpanFields.GEN_AI_OUTPUT_MESSAGES]).toBe(outputMessages);
    expect(nodeAttributes?.[SpanFields.GEN_AI_REQUEST_MESSAGES]).toBe(requestMessages);
    expect(nodeAttributes?.[SpanFields.GEN_AI_RESPONSE_TEXT]).toBe('Response text');
    expect(nodeAttributes?.[SpanFields.GEN_AI_RESPONSE_OBJECT]).toBe('{"key": "value"}');
    expect(nodeAttributes?.[SpanFields.GEN_AI_TOOL_NAME]).toBe('test-tool');
    expect(nodeAttributes?.[SpanFields.USER_EMAIL]).toBe('test@example.com');
  });

  it('defaults missing optional fields to empty strings', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/ai-conversations/test-conversation/',
      body: [
        {
          span_id: 'span-1',
          trace: 'trace-1',
          parent_span: 'parent-1',
          'precise.start_ts': 1000,
          'precise.finish_ts': 1001,
          project: 'test-project',
          'project.id': 1,
          'span.description': 'Test span',
          'span.op': 'gen_ai.stream_text',
          'span.status': 'ok',
          'gen_ai.conversation.id': 'test-conversation',
        },
      ],
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'test-conversation'}),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    const nodeAttributes = result.current.nodes[0]?.attributes;
    expect(nodeAttributes?.[SpanFields.GEN_AI_INPUT_MESSAGES]).toBe('');
    expect(nodeAttributes?.[SpanFields.GEN_AI_OUTPUT_MESSAGES]).toBe('');
    expect(nodeAttributes?.[SpanFields.GEN_AI_REQUEST_MESSAGES]).toBe('');
    expect(nodeAttributes?.[SpanFields.GEN_AI_RESPONSE_TEXT]).toBe('');
  });

  it('returns empty nodes when conversationId is empty', () => {
    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: ''}),
      {organization}
    );

    expect(result.current.nodes).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBe(false);
  });

  it('filters to only gen_ai spans', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/ai-conversations/test-conversation/',
      body: [
        {
          span_id: 'span-1',
          trace: 'trace-1',
          parent_span: 'parent-1',
          'precise.start_ts': 1000,
          'precise.finish_ts': 1001,
          project: 'test-project',
          'project.id': 1,
          'span.description': 'HTTP span',
          'span.op': 'http.client',
          'span.status': 'ok',
          'gen_ai.conversation.id': 'test-conversation',
        },
        {
          span_id: 'span-2',
          trace: 'trace-1',
          parent_span: 'parent-1',
          'precise.start_ts': 1002,
          'precise.finish_ts': 1003,
          project: 'test-project',
          'project.id': 1,
          'span.description': 'Gen AI span',
          'span.op': 'gen_ai.stream_text',
          'span.status': 'ok',
          'gen_ai.conversation.id': 'test-conversation',
          'gen_ai.operation.type': 'ai_client',
        },
      ],
    });

    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: 'test-conversation'}),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.nodes).toHaveLength(1);
    expect(result.current.nodes[0]?.id).toBe('span-2');
  });
});
