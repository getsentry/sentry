import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {SpanFields} from 'sentry/views/insights/types';

import {useConversation} from './useConversation';

describe('useConversation', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('returns empty nodes when conversationId is empty', () => {
    const {result} = renderHookWithProviders(
      () => useConversation({conversationId: ''}),
      {organization}
    );

    expect(result.current.nodes).toEqual([]);
    expect(result.current.isLoading).toBe(false);
  });

  it('maps gen_ai.input.messages to node attributes', async () => {
    const inputMessages = JSON.stringify([{role: 'user', content: 'Hello from input'}]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/ai-conversations/conv-123/`,
      body: [
        {
          'gen_ai.conversation.id': 'conv-123',
          parent_span: 'parent-1',
          'precise.finish_ts': 1000.5,
          'precise.start_ts': 1000.0,
          project: 'test-project',
          'project.id': 1,
          'span.description': 'AI generation',
          'span.op': 'gen_ai.generate',
          'span.status': 'ok',
          span_id: 'span-1',
          trace: 'trace-1',
          'gen_ai.operation.type': 'ai_client',
          'gen_ai.input.messages': inputMessages,
          'gen_ai.request.messages': JSON.stringify([
            {role: 'user', content: 'Fallback message'},
          ]),
        },
      ],
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
      url: `/organizations/${organization.slug}/ai-conversations/conv-output/`,
      body: [
        {
          'gen_ai.conversation.id': 'conv-output',
          parent_span: 'parent-1',
          'precise.finish_ts': 1000.5,
          'precise.start_ts': 1000.0,
          project: 'test-project',
          'project.id': 1,
          'span.description': 'AI generation',
          'span.op': 'gen_ai.generate',
          'span.status': 'ok',
          span_id: 'span-output',
          trace: 'trace-output',
          'gen_ai.operation.type': 'ai_client',
          'gen_ai.output.messages': outputMessages,
        },
      ],
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

  it('maps gen_ai.request.messages to node attributes', async () => {
    const requestMessages = JSON.stringify([
      {role: 'user', content: 'Hello from request'},
    ]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/ai-conversations/conv-456/`,
      body: [
        {
          'gen_ai.conversation.id': 'conv-456',
          parent_span: 'parent-1',
          'precise.finish_ts': 1000.5,
          'precise.start_ts': 1000.0,
          project: 'test-project',
          'project.id': 1,
          'span.description': 'AI generation',
          'span.op': 'gen_ai.generate',
          'span.status': 'ok',
          span_id: 'span-2',
          trace: 'trace-2',
          'gen_ai.operation.type': 'ai_client',
          'gen_ai.request.messages': requestMessages,
        },
      ],
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
      url: `/organizations/${organization.slug}/ai-conversations/conv-789/`,
      body: [
        {
          'gen_ai.conversation.id': 'conv-789',
          parent_span: 'parent-1',
          'precise.finish_ts': 1000.5,
          'precise.start_ts': 1000.0,
          project: 'test-project',
          'project.id': 1,
          'span.description': 'AI generation',
          'span.op': 'gen_ai.generate',
          'span.status': 'ok',
          span_id: 'span-3',
          trace: 'trace-3',
          'gen_ai.operation.type': 'ai_client',
          // No input or request messages provided
        },
      ],
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

  it('filters to only gen_ai spans', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/ai-conversations/conv-filter/`,
      body: [
        {
          'gen_ai.conversation.id': 'conv-filter',
          parent_span: 'parent-1',
          'precise.finish_ts': 1000.5,
          'precise.start_ts': 1000.0,
          project: 'test-project',
          'project.id': 1,
          'span.description': 'AI generation',
          'span.op': 'gen_ai.generate',
          'span.status': 'ok',
          span_id: 'span-ai',
          trace: 'trace-1',
          'gen_ai.operation.type': 'ai_client',
        },
        {
          'gen_ai.conversation.id': 'conv-filter',
          parent_span: 'parent-1',
          'precise.finish_ts': 1001.5,
          'precise.start_ts': 1001.0,
          project: 'test-project',
          'project.id': 1,
          'span.description': 'HTTP request',
          'span.op': 'http.client',
          'span.status': 'ok',
          span_id: 'span-http',
          trace: 'trace-1',
          // No gen_ai.operation.type - should be filtered out
        },
      ],
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
});
