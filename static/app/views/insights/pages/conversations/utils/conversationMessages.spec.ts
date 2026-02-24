import {SpanFields} from 'sentry/views/insights/types';

import {
  buildConversationTurns,
  extractMessagesFromNodes,
  extractTextFromMessage,
  findToolCallsBetween,
  getNodeTimestamp,
  mergeEmptyTurns,
  parseAssistantContent,
  parseUserContent,
  partitionSpansByType,
  turnsToMessages,
} from './conversationMessages';

function createMockNode(overrides: {
  id: string;
  attributes?: Record<string, string | number>;
  startTimestamp?: number;
}) {
  const {id, attributes = {}, startTimestamp = 1000} = overrides;
  return {
    id,
    type: 'span' as const,
    op: 'gen_ai.generate',
    startTimestamp,
    value: {
      start_timestamp: startTimestamp,
    },
    attributes: {
      [SpanFields.GEN_AI_OPERATION_TYPE]: 'ai_client',
      ...attributes,
    },
    errors: new Set(),
  };
}

function createMockToolNode(overrides: {
  id: string;
  toolName: string;
  startTimestamp?: number;
}) {
  const {id, toolName, startTimestamp = 1000} = overrides;
  return {
    id,
    type: 'span' as const,
    op: 'gen_ai.execute_tool',
    startTimestamp,
    value: {
      start_timestamp: startTimestamp,
    },
    attributes: {
      [SpanFields.GEN_AI_OPERATION_TYPE]: 'tool',
      [SpanFields.GEN_AI_TOOL_NAME]: toolName,
    },
    errors: new Set(),
  };
}

describe('conversationMessages utilities', () => {
  describe('getNodeTimestamp', () => {
    it('returns start_timestamp from node value', () => {
      const node = createMockNode({id: 'node-1', startTimestamp: 1500});
      expect(getNodeTimestamp(node as any)).toBe(1500);
    });

    it('returns 0 when start_timestamp is not present', () => {
      const node = {id: 'node-1', value: {}} as any;
      expect(getNodeTimestamp(node)).toBe(0);
    });
  });

  describe('extractTextFromMessage', () => {
    it('extracts text from string content', () => {
      const msg = {role: 'user', content: 'Hello world'};
      expect(extractTextFromMessage(msg)).toBe('Hello world');
    });

    it('extracts text from array content format', () => {
      const msg = {role: 'user', content: [{text: 'Array message'}]};
      expect(extractTextFromMessage(msg)).toBe('Array message');
    });

    it('joins multiple array content elements with newlines', () => {
      const msg = {
        role: 'user',
        content: [{text: 'First part'}, {text: 'Second part'}],
      };
      expect(extractTextFromMessage(msg)).toBe('First part\nSecond part');
    });

    it('extracts text from parts format with content field', () => {
      const msg = {
        role: 'user',
        parts: [{type: 'text', content: 'Parts message'}],
      };
      expect(extractTextFromMessage(msg)).toBe('Parts message');
    });

    it('extracts text from parts format with text field', () => {
      const msg = {
        role: 'user',
        parts: [{type: 'text', text: 'Parts text field'}],
      };
      expect(extractTextFromMessage(msg)).toBe('Parts text field');
    });

    it('joins multiple text parts with newlines', () => {
      const msg = {
        role: 'user',
        parts: [
          {type: 'text', content: 'Line 1'},
          {type: 'text', content: 'Line 2'},
        ],
      };
      expect(extractTextFromMessage(msg)).toBe('Line 1\nLine 2');
    });

    it('filters non-text parts', () => {
      const msg = {
        role: 'user',
        parts: [
          {type: 'image', content: 'image-data'},
          {type: 'text', content: 'Text only'},
        ],
      };
      expect(extractTextFromMessage(msg)).toBe('Text only');
    });

    it('returns null when no content', () => {
      const msg = {role: 'user'};
      expect(extractTextFromMessage(msg)).toBeNull();
    });

    it('returns null when empty array content', () => {
      const msg = {role: 'user', content: [] as Array<{text: string}>};
      expect(extractTextFromMessage(msg)).toBeNull();
    });
  });

  describe('parseUserContent', () => {
    it('parses user message from gen_ai.input.messages', () => {
      const messages = JSON.stringify([{role: 'user', content: 'User input'}]);
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_INPUT_MESSAGES]: messages,
        },
      });
      expect(parseUserContent(node as any)).toBe('User input');
    });

    it('falls back to gen_ai.request.messages', () => {
      const messages = JSON.stringify([{role: 'user', content: 'Request message'}]);
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_REQUEST_MESSAGES]: messages,
        },
      });
      expect(parseUserContent(node as any)).toBe('Request message');
    });

    it('prefers gen_ai.input.messages over gen_ai.request.messages', () => {
      const inputMessages = JSON.stringify([{role: 'user', content: 'Input wins'}]);
      const requestMessages = JSON.stringify([{role: 'user', content: 'Request loses'}]);
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_INPUT_MESSAGES]: inputMessages,
          [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
        },
      });
      expect(parseUserContent(node as any)).toBe('Input wins');
    });

    it('falls back to request.messages when input.messages is empty string', () => {
      const requestMessages = JSON.stringify([
        {role: 'user', content: 'Request fallback'},
      ]);
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_INPUT_MESSAGES]: '',
          [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
        },
      });
      expect(parseUserContent(node as any)).toBe('Request fallback');
    });

    it('finds last user message in array', () => {
      const messages = JSON.stringify([
        {role: 'system', content: 'System prompt'},
        {role: 'user', content: 'First user'},
        {role: 'assistant', content: 'Response'},
        {role: 'user', content: 'Last user'},
      ]);
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_INPUT_MESSAGES]: messages,
        },
      });
      expect(parseUserContent(node as any)).toBe('Last user');
    });

    it('returns null when no user message exists', () => {
      const messages = JSON.stringify([{role: 'system', content: 'System only'}]);
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_INPUT_MESSAGES]: messages,
        },
      });
      expect(parseUserContent(node as any)).toBeNull();
    });

    it('returns null on parse error instead of raw string', () => {
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_INPUT_MESSAGES]: 'not valid json',
        },
      });
      expect(parseUserContent(node as any)).toBeNull();
    });

    it('returns null when request messages JSON is truncated', () => {
      const truncatedJson =
        '[{"role":"assistant","content":[{"type":"tool_use","name":"search","input":"{}"}]},{"role":"user","content":[{"type":"tool_result","tool_use_id":"toolu_123","content":"GoCD API 401 Unautho';
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_REQUEST_MESSAGES]: truncatedJson,
        },
      });
      expect(parseUserContent(node as any)).toBeNull();
    });

    it('returns null when no messages attribute', () => {
      const node = createMockNode({id: 'node-1'});
      expect(parseUserContent(node as any)).toBeNull();
    });
  });

  describe('parseAssistantContent', () => {
    it('parses assistant message from gen_ai.output.messages', () => {
      const messages = JSON.stringify([{role: 'assistant', content: 'Output response'}]);
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_OUTPUT_MESSAGES]: messages,
        },
      });
      expect(parseAssistantContent(node as any)).toBe('Output response');
    });

    it('falls back to gen_ai.response.text', () => {
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Response text fallback',
        },
      });
      expect(parseAssistantContent(node as any)).toBe('Response text fallback');
    });

    it('falls back to gen_ai.response.object', () => {
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_RESPONSE_OBJECT]: 'Response object fallback',
        },
      });
      expect(parseAssistantContent(node as any)).toBe('Response object fallback');
    });

    it('prefers gen_ai.output.messages over response.text', () => {
      const outputMessages = JSON.stringify([
        {role: 'assistant', content: 'Output wins'},
      ]);
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_OUTPUT_MESSAGES]: outputMessages,
          [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Response loses',
        },
      });
      expect(parseAssistantContent(node as any)).toBe('Output wins');
    });

    it('returns null when no assistant content', () => {
      const node = createMockNode({id: 'node-1'});
      expect(parseAssistantContent(node as any)).toBeNull();
    });
  });

  describe('partitionSpansByType', () => {
    it('separates generation and tool spans', () => {
      const generationNode = createMockNode({id: 'gen-1', startTimestamp: 1000});
      const toolNode = createMockToolNode({
        id: 'tool-1',
        toolName: 'search',
        startTimestamp: 1500,
      });
      const result = partitionSpansByType([generationNode, toolNode] as any);

      expect(result.generationSpans).toHaveLength(1);
      expect(result.toolSpans).toHaveLength(1);
      expect(result.generationSpans[0]?.id).toBe('gen-1');
      expect(result.toolSpans[0]?.id).toBe('tool-1');
    });

    it('sorts by timestamp', () => {
      const gen1 = createMockNode({id: 'gen-1', startTimestamp: 2000});
      const gen2 = createMockNode({id: 'gen-2', startTimestamp: 1000});
      const tool1 = createMockToolNode({
        id: 'tool-1',
        toolName: 'a',
        startTimestamp: 3000,
      });
      const tool2 = createMockToolNode({
        id: 'tool-2',
        toolName: 'b',
        startTimestamp: 1500,
      });

      const result = partitionSpansByType([gen1, gen2, tool1, tool2] as any);

      expect(result.generationSpans.map(s => s.id)).toEqual(['gen-2', 'gen-1']);
      expect(result.toolSpans.map(s => s.id)).toEqual(['tool-2', 'tool-1']);
    });

    it('ignores spans without recognized operation type', () => {
      const unknownNode = {
        id: 'unknown',
        value: {start_timestamp: 1000},
        attributes: {[SpanFields.GEN_AI_OPERATION_TYPE]: 'unknown'},
        errors: new Set(),
      };
      const genNode = createMockNode({id: 'gen-1'});

      const result = partitionSpansByType([unknownNode, genNode] as any);

      expect(result.generationSpans).toHaveLength(1);
      expect(result.toolSpans).toHaveLength(0);
    });
  });

  describe('findToolCallsBetween', () => {
    it('finds tools between timestamps', () => {
      const tool1 = createMockToolNode({
        id: 'tool-1',
        toolName: 'search',
        startTimestamp: 1500,
      });
      const tool2 = createMockToolNode({
        id: 'tool-2',
        toolName: 'calc',
        startTimestamp: 1600,
      });
      const tool3 = createMockToolNode({
        id: 'tool-3',
        toolName: 'outside',
        startTimestamp: 2500,
      });

      const result = findToolCallsBetween([tool1, tool2, tool3] as any, 1000, 2000);

      expect(result).toHaveLength(2);
      expect(result.map(t => t.name)).toEqual(['search', 'calc']);
    });

    it('excludes tools at exact boundaries', () => {
      const tool1 = createMockToolNode({
        id: 'tool-1',
        toolName: 'at-start',
        startTimestamp: 1000,
      });
      const tool2 = createMockToolNode({
        id: 'tool-2',
        toolName: 'at-end',
        startTimestamp: 2000,
      });
      const tool3 = createMockToolNode({
        id: 'tool-3',
        toolName: 'inside',
        startTimestamp: 1500,
      });

      const result = findToolCallsBetween([tool1, tool2, tool3] as any, 1000, 2000);

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('inside');
    });

    it('filters out tools without names', () => {
      const toolWithName = createMockToolNode({
        id: 'tool-1',
        toolName: 'named',
        startTimestamp: 1500,
      });
      const toolWithoutName = {
        id: 'tool-2',
        value: {start_timestamp: 1600},
        attributes: {[SpanFields.GEN_AI_OPERATION_TYPE]: 'tool'},
        errors: new Set(),
      };

      const result = findToolCallsBetween(
        [toolWithName, toolWithoutName] as any,
        1000,
        2000
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.name).toBe('named');
    });
  });

  describe('buildConversationTurns', () => {
    it('builds turns with user and assistant content', () => {
      const requestMessages = JSON.stringify([{role: 'user', content: 'Hello'}]);
      const genNode = createMockNode({
        id: 'gen-1',
        startTimestamp: 1000,
        attributes: {
          [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
          [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Hi there',
        },
      });

      const turns = buildConversationTurns([genNode as any], []);

      expect(turns).toHaveLength(1);
      expect(turns[0]?.userContent).toBe('Hello');
      expect(turns[0]?.assistantContent).toBe('Hi there');
    });

    it('assigns tool calls to correct generation', () => {
      const gen1 = createMockNode({id: 'gen-1', startTimestamp: 1000});
      const tool = createMockToolNode({
        id: 'tool-1',
        toolName: 'search',
        startTimestamp: 1500,
      });
      const gen2 = createMockNode({id: 'gen-2', startTimestamp: 2000});

      const turns = buildConversationTurns([gen1, gen2] as any, [tool] as any);

      expect(turns[0]?.toolCalls).toHaveLength(0);
      expect(turns[1]?.toolCalls).toHaveLength(1);
      expect(turns[1]?.toolCalls[0]?.name).toBe('search');
    });
  });

  describe('mergeEmptyTurns', () => {
    it('merges tool calls from empty turns into next turn', () => {
      const turns = [
        {
          generation: {id: 'gen-1'} as any,
          userContent: 'Question 1',
          assistantContent: null,
          toolCalls: [{name: 'search', nodeId: 'tool-1', hasError: false}],
          userEmail: undefined,
        },
        {
          generation: {id: 'gen-2'} as any,
          userContent: 'Question 2',
          assistantContent: 'Answer',
          toolCalls: [{name: 'calc', nodeId: 'tool-2', hasError: false}],
          userEmail: undefined,
        },
      ];

      const merged = mergeEmptyTurns(turns);

      expect(merged).toHaveLength(2);
      expect(merged[1]?.toolCalls).toHaveLength(2);
      expect(merged[1]?.toolCalls.map(t => t.name)).toEqual(['search', 'calc']);
    });

    it('chains multiple empty turns', () => {
      const turns = [
        {
          generation: {id: 'gen-1'} as any,
          userContent: 'Q1',
          assistantContent: null,
          toolCalls: [{name: 'tool-a', nodeId: 't-1', hasError: false}],
          userEmail: undefined,
        },
        {
          generation: {id: 'gen-2'} as any,
          userContent: null,
          assistantContent: null,
          toolCalls: [{name: 'tool-b', nodeId: 't-2', hasError: false}],
          userEmail: undefined,
        },
        {
          generation: {id: 'gen-3'} as any,
          userContent: 'Q2',
          assistantContent: 'Final answer',
          toolCalls: [{name: 'tool-c', nodeId: 't-3', hasError: false}],
          userEmail: undefined,
        },
      ];

      const merged = mergeEmptyTurns(turns);

      // Turn 1 keeps user content but no tool calls (they moved to turn 3)
      // Turn 2 is skipped (no user content, no assistant content)
      // Turn 3 has all tool calls merged
      expect(merged).toHaveLength(2);
      expect(merged[1]?.toolCalls).toHaveLength(3);
      expect(merged[1]?.toolCalls.map(t => t.name)).toEqual([
        'tool-a',
        'tool-b',
        'tool-c',
      ]);
    });

    it('preserves user content turns even without assistant response', () => {
      const turns = [
        {
          generation: {id: 'gen-1'} as any,
          userContent: 'Question without answer',
          assistantContent: null,
          toolCalls: [],
          userEmail: undefined,
        },
      ];

      const merged = mergeEmptyTurns(turns);

      expect(merged).toHaveLength(1);
      expect(merged[0]?.userContent).toBe('Question without answer');
    });
  });

  describe('turnsToMessages', () => {
    it('creates user and assistant messages from turns', () => {
      const turns = [
        {
          generation: {id: 'gen-1', value: {start_timestamp: 1000}} as any,
          userContent: 'Hello',
          assistantContent: 'Hi there',
          toolCalls: [],
          userEmail: 'user@example.com',
        },
      ];

      const messages = turnsToMessages(turns);

      expect(messages).toHaveLength(2);
      expect(messages[0]).toMatchObject({
        role: 'user',
        content: 'Hello',
        userEmail: 'user@example.com',
      });
      expect(messages[1]).toMatchObject({
        role: 'assistant',
        content: 'Hi there',
      });
    });

    it('deduplicates user messages by exact content', () => {
      const turns = [
        {
          generation: {id: 'gen-1', value: {start_timestamp: 1000}} as any,
          userContent: 'Hello',
          assistantContent: 'Response 1',
          toolCalls: [],
          userEmail: undefined,
        },
        {
          generation: {id: 'gen-2', value: {start_timestamp: 2000}} as any,
          userContent: 'Hello', // Exact same content
          assistantContent: 'Response 2',
          toolCalls: [],
          userEmail: undefined,
        },
      ];

      const messages = turnsToMessages(turns);

      // Should have 1 user message and 2 assistant messages
      const userMessages = messages.filter(m => m.role === 'user');
      const assistantMessages = messages.filter(m => m.role === 'assistant');

      expect(userMessages).toHaveLength(1);
      expect(assistantMessages).toHaveLength(2);
    });

    it('does not deduplicate user messages with different whitespace or case', () => {
      const turns = [
        {
          generation: {id: 'gen-1', value: {start_timestamp: 1000}} as any,
          userContent: 'Hello',
          assistantContent: 'Response 1',
          toolCalls: [],
          userEmail: undefined,
        },
        {
          generation: {id: 'gen-2', value: {start_timestamp: 2000}} as any,
          userContent: '  HELLO  ', // Different due to whitespace and case
          assistantContent: 'Response 2',
          toolCalls: [],
          userEmail: undefined,
        },
      ];

      const messages = turnsToMessages(turns);

      const userMessages = messages.filter(m => m.role === 'user');
      expect(userMessages).toHaveLength(2);
    });

    it('deduplicates assistant messages by exact content', () => {
      const turns = [
        {
          generation: {id: 'gen-1', value: {start_timestamp: 1000}} as any,
          userContent: 'Question 1',
          assistantContent: 'Same response',
          toolCalls: [],
          userEmail: undefined,
        },
        {
          generation: {id: 'gen-2', value: {start_timestamp: 2000}} as any,
          userContent: 'Question 2',
          assistantContent: 'Same response', // Exact same content
          toolCalls: [],
          userEmail: undefined,
        },
      ];

      const messages = turnsToMessages(turns);

      const assistantMessages = messages.filter(m => m.role === 'assistant');
      expect(assistantMessages).toHaveLength(1);
    });

    it('attaches tool calls to assistant messages', () => {
      const turns = [
        {
          generation: {id: 'gen-1', value: {start_timestamp: 1000}} as any,
          userContent: 'Question',
          assistantContent: 'Answer',
          toolCalls: [{name: 'search', nodeId: 'tool-1', hasError: false}],
          userEmail: undefined,
        },
      ];

      const messages = turnsToMessages(turns);

      const assistantMessage = messages.find(m => m.role === 'assistant');
      expect(assistantMessage?.toolCalls).toHaveLength(1);
      expect(assistantMessage?.toolCalls?.[0]?.name).toBe('search');
    });

    it('sorts messages by timestamp', () => {
      const turns = [
        {
          generation: {id: 'gen-1', value: {start_timestamp: 2000}} as any,
          userContent: 'Second',
          assistantContent: 'Second response',
          toolCalls: [],
          userEmail: undefined,
        },
        {
          generation: {id: 'gen-2', value: {start_timestamp: 1000}} as any,
          userContent: 'First',
          assistantContent: 'First response',
          toolCalls: [],
          userEmail: undefined,
        },
      ];

      const messages = turnsToMessages(turns);

      expect(messages[0]?.content).toBe('First');
      expect(messages[1]?.content).toBe('First response');
      expect(messages[2]?.content).toBe('Second');
      expect(messages[3]?.content).toBe('Second response');
    });
  });

  describe('extractMessagesFromNodes (integration)', () => {
    it('extracts messages from a simple conversation', () => {
      const requestMessages = JSON.stringify([{role: 'user', content: 'Hello'}]);
      const node = createMockNode({
        id: 'span-1',
        startTimestamp: 1000,
        attributes: {
          [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
          [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Hi there',
        },
      });

      const messages = extractMessagesFromNodes([node as any]);

      expect(messages).toHaveLength(2);
      expect(messages[0]).toMatchObject({role: 'user', content: 'Hello'});
      expect(messages[1]).toMatchObject({role: 'assistant', content: 'Hi there'});
    });

    it('handles tool calls between generations', () => {
      const requestMessages = JSON.stringify([{role: 'user', content: 'Check weather'}]);

      const gen1 = createMockNode({
        id: 'gen-1',
        startTimestamp: 1000,
        attributes: {
          [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
          [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Let me check',
        },
      });

      const tool = createMockToolNode({
        id: 'tool-1',
        toolName: 'weather',
        startTimestamp: 1500,
      });

      const gen2 = createMockNode({
        id: 'gen-2',
        startTimestamp: 2000,
        attributes: {
          [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
          [SpanFields.GEN_AI_RESPONSE_TEXT]: 'The weather is sunny',
        },
      });

      const messages = extractMessagesFromNodes([gen1, tool, gen2] as any);

      const secondAssistant = messages.find(
        m => m.role === 'assistant' && m.content === 'The weather is sunny'
      );
      expect(secondAssistant?.toolCalls).toHaveLength(1);
      expect(secondAssistant?.toolCalls?.[0]?.name).toBe('weather');
    });

    it('carries forward tool calls from spans without text', () => {
      const requestMessages = JSON.stringify([
        {role: 'user', content: 'Compare weather'},
      ]);

      // First generation with response
      const gen1 = createMockNode({
        id: 'gen-1',
        startTimestamp: 1000,
        attributes: {
          [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
          [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Let me check Spain',
        },
      });

      // Tool calls
      const tool1 = createMockToolNode({
        id: 'tool-1',
        toolName: 'weather',
        startTimestamp: 1500,
      });
      const tool2 = createMockToolNode({
        id: 'tool-2',
        toolName: 'weather',
        startTimestamp: 1600,
      });

      // Generation WITHOUT text response
      const gen2 = createMockNode({
        id: 'gen-2',
        startTimestamp: 2000,
        attributes: {
          [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
          // No response text
        },
      });

      // Another tool call
      const tool3 = createMockToolNode({
        id: 'tool-3',
        toolName: 'calculator',
        startTimestamp: 2500,
      });

      // Final generation with response
      const gen3 = createMockNode({
        id: 'gen-3',
        startTimestamp: 3000,
        attributes: {
          [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
          [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Here is the comparison',
        },
      });

      const messages = extractMessagesFromNodes([
        gen1,
        tool1,
        tool2,
        gen2,
        tool3,
        gen3,
      ] as any);

      // The final message should have all tool calls
      const finalAssistant = messages.find(
        m => m.role === 'assistant' && m.content === 'Here is the comparison'
      );
      expect(finalAssistant?.toolCalls).toHaveLength(3);
      expect(finalAssistant?.toolCalls?.map(t => t.name)).toEqual([
        'weather',
        'weather',
        'calculator',
      ]);
    });

    it('deduplicates messages', () => {
      const sameMessage = JSON.stringify([{role: 'user', content: 'Duplicate'}]);

      const node1 = createMockNode({
        id: 'span-1',
        startTimestamp: 1000,
        attributes: {
          [SpanFields.GEN_AI_REQUEST_MESSAGES]: sameMessage,
          [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Response 1',
        },
      });

      const node2 = createMockNode({
        id: 'span-2',
        startTimestamp: 2000,
        attributes: {
          [SpanFields.GEN_AI_REQUEST_MESSAGES]: sameMessage,
          [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Response 2',
        },
      });

      const messages = extractMessagesFromNodes([node1, node2] as any);

      const userMessages = messages.filter(m => m.role === 'user');
      const assistantMessages = messages.filter(m => m.role === 'assistant');

      expect(userMessages).toHaveLength(1);
      expect(assistantMessages).toHaveLength(2);
    });

    it('returns empty array for empty input', () => {
      expect(extractMessagesFromNodes([])).toEqual([]);
    });

    it('returns empty array when no generation spans', () => {
      const tool = createMockToolNode({id: 'tool-1', toolName: 'search'});
      expect(extractMessagesFromNodes([tool as any])).toEqual([]);
    });
  });
});
