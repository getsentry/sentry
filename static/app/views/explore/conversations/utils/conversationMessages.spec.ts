import {SpanFields} from 'sentry/views/insights/types';

import {
  buildConversationTurns,
  extractMessagesFromNodes,
  getInputMessageStats,
  getNodeTimestamp,
  mergeEmptyTurns,
  messagesToMarkdown,
  parseAssistantContent,
  parseUserContent,
  partitionSpansByType,
  turnsToMessages,
} from './conversationMessages';

function createMockNode(overrides: {
  id: string;
  attributes?: Record<string, string | number>;
  endTimestamp?: number;
  startTimestamp?: number;
}) {
  const {id, attributes = {}, startTimestamp = 1000, endTimestamp} = overrides;
  const end = endTimestamp ?? startTimestamp + 100;
  return {
    id,
    type: 'span' as const,
    op: 'gen_ai.generate',
    startTimestamp,
    endTimestamp: end,
    value: {
      start_timestamp: startTimestamp,
      end_timestamp: end,
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
  endTimestamp?: number;
  startTimestamp?: number;
}) {
  const {id, toolName, startTimestamp = 1000, endTimestamp} = overrides;
  const end = endTimestamp ?? startTimestamp + 100;
  return {
    id,
    type: 'span' as const,
    op: 'gen_ai.execute_tool',
    startTimestamp,
    endTimestamp: end,
    value: {
      start_timestamp: startTimestamp,
      end_timestamp: end,
    },
    attributes: {
      [SpanFields.GEN_AI_OPERATION_TYPE]: 'tool',
      [SpanFields.GEN_AI_TOOL_NAME]: toolName,
    },
    errors: new Set(),
  };
}

type Turn = Parameters<typeof turnsToMessages>[0][number];

function makeTurn(overrides: Partial<Turn> = {}): Turn {
  return {
    generation: {
      id: 'gen-1',
      value: {start_timestamp: 1000, end_timestamp: 1100},
    } as any,
    userContent: null,
    assistantContent: null,
    toolCalls: [],
    reasoning: null,
    userEmail: undefined,
    ...overrides,
  };
}

describe('conversationMessages utilities', () => {
  describe('getNodeTimestamp', () => {
    it('returns end_timestamp from node value', () => {
      const node = createMockNode({
        id: 'node-1',
        startTimestamp: 1500,
        endTimestamp: 1600,
      });
      expect(getNodeTimestamp(node as any)).toBe(1600);
    });

    it('returns 0 when no timestamp is present', () => {
      const node = {id: 'node-1', value: {}} as any;
      expect(getNodeTimestamp(node)).toBe(0);
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

    it('treats a plain string as the user message', () => {
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_INPUT_MESSAGES]: 'not valid json',
        },
      });
      expect(parseUserContent(node as any)).toBe('not valid json');
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

    it('returns [Filtered] when input messages are scrubbed', () => {
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_INPUT_MESSAGES]: '[Filtered]',
        },
      });
      expect(parseUserContent(node as any)).toBe('[Filtered]');
    });

    it('parses parts-format user messages', () => {
      const messages = JSON.stringify([
        {role: 'user', parts: [{type: 'text', content: 'Parts question'}]},
      ]);
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_INPUT_MESSAGES]: messages,
        },
      });
      expect(parseUserContent(node as any)).toBe('Parts question');
    });

    it('unwraps OpenRouter-style {messages: [...]} wrapper', () => {
      const messages = JSON.stringify({
        messages: [{role: 'user', content: 'Wrapped question'}],
      });
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_REQUEST_MESSAGES]: messages,
        },
      });
      expect(parseUserContent(node as any)).toBe('Wrapped question');
    });
  });

  describe('getInputMessageStats', () => {
    it.each([
      {
        name: 'counts total and user messages in a cumulative history',
        input: JSON.stringify([
          {role: 'user', content: 'First'},
          {role: 'assistant', content: 'Reply'},
          {role: 'user', content: 'Second'},
        ]),
        expected: {totalMessageCount: 3, userMessageCount: 2},
      },
      {
        name: 'reports a single-message input as non-cumulative',
        input: JSON.stringify([{role: 'user', content: 'Only message'}]),
        expected: {totalMessageCount: 1, userMessageCount: 1},
      },
      {
        name: 'excludes system messages from counts',
        input: JSON.stringify([
          {role: 'system', content: 'You are a helpful assistant'},
          {role: 'user', content: 'Hello'},
        ]),
        expected: {totalMessageCount: 1, userMessageCount: 1},
      },
      {
        name: 'returns zeroes when input is scrubbed',
        input: '[Filtered]',
        expected: {totalMessageCount: 0, userMessageCount: 0},
      },
    ])('$name', ({input, expected}) => {
      const node = createMockNode({
        id: 'node-1',
        attributes: {[SpanFields.GEN_AI_INPUT_MESSAGES]: input},
      });
      expect(getInputMessageStats(node as any)).toEqual(expected);
    });

    it('returns zeroes when input is missing', () => {
      const node = createMockNode({id: 'node-1'});
      expect(getInputMessageStats(node as any)).toEqual({
        totalMessageCount: 0,
        userMessageCount: 0,
      });
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
      expect(parseAssistantContent(node as any).content).toBe('Output response');
    });

    it('falls back to gen_ai.response.text', () => {
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Response text fallback',
        },
      });
      expect(parseAssistantContent(node as any).content).toBe('Response text fallback');
    });

    it('falls back to gen_ai.response.object', () => {
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_RESPONSE_OBJECT]: 'Response object fallback',
        },
      });
      expect(parseAssistantContent(node as any).content).toBe('Response object fallback');
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
      expect(parseAssistantContent(node as any).content).toBe('Output wins');
    });

    it('returns null content when no assistant content', () => {
      const node = createMockNode({id: 'node-1'});
      expect(parseAssistantContent(node as any).content).toBeNull();
    });

    it('extracts content from non-array JSON object in output messages', () => {
      const outputObj = JSON.stringify({content: 'Object content response'});
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_OUTPUT_MESSAGES]: outputObj,
        },
      });
      expect(parseAssistantContent(node as any).content).toBe('Object content response');
    });

    it('falls back to response.text when output messages is object without content', () => {
      const outputObj = JSON.stringify({other: 'no content key'});
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_OUTPUT_MESSAGES]: outputObj,
          [SpanFields.GEN_AI_RESPONSE_TEXT]: 'Fallback text',
        },
      });
      expect(parseAssistantContent(node as any).content).toBe('Fallback text');
    });

    it('returns [Filtered] when output messages are scrubbed', () => {
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_OUTPUT_MESSAGES]: '[Filtered]',
        },
      });
      expect(parseAssistantContent(node as any).content).toBe('[Filtered]');
    });

    it('treats a plain string output.messages as the assistant response', () => {
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_OUTPUT_MESSAGES]: 'just a plain response',
        },
      });
      expect(parseAssistantContent(node as any).content).toBe('just a plain response');
    });

    it('parses parts-format assistant messages', () => {
      const messages = JSON.stringify([
        {role: 'assistant', parts: [{type: 'text', text: 'Parts response'}]},
      ]);
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_OUTPUT_MESSAGES]: messages,
        },
      });
      expect(parseAssistantContent(node as any).content).toBe('Parts response');
    });

    it('falls back to response.text when output.messages has no assistant role', () => {
      const messages = JSON.stringify([{role: 'user', content: 'no assistant here'}]);
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_OUTPUT_MESSAGES]: messages,
          [SpanFields.GEN_AI_RESPONSE_TEXT]: 'fallback text',
        },
      });
      expect(parseAssistantContent(node as any).content).toBe('fallback text');
    });

    it('returns null content when output.messages has tool calls but no text', () => {
      const messages = JSON.stringify([
        {
          role: 'assistant',
          parts: [{type: 'tool_call', toolCallId: 'tc-1', toolName: 'search', args: {}}],
        },
      ]);
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_OUTPUT_MESSAGES]: messages,
          [SpanFields.GEN_AI_RESPONSE_OBJECT]: '{"tool_calls": [{"name": "search"}]}',
        },
      });
      // Should NOT fall through to gen_ai.response.object
      expect(parseAssistantContent(node as any).content).toBeNull();
    });

    it('returns text when output.messages has both text and tool calls', () => {
      const messages = JSON.stringify([
        {
          role: 'assistant',
          parts: [
            {type: 'text', text: 'Let me search for that'},
            {type: 'tool_call', toolCallId: 'tc-1', toolName: 'search', args: {}},
          ],
        },
      ]);
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_OUTPUT_MESSAGES]: messages,
        },
      });
      expect(parseAssistantContent(node as any).content).toBe('Let me search for that');
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

    it('sorts by end timestamp, not start timestamp', () => {
      // gen-1 starts later but ends first
      const gen1 = createMockNode({
        id: 'gen-1',
        startTimestamp: 2000,
        endTimestamp: 2100,
      });
      // gen-2 starts earlier but ends later
      const gen2 = createMockNode({
        id: 'gen-2',
        startTimestamp: 1000,
        endTimestamp: 3000,
      });
      const tool1 = createMockToolNode({
        id: 'tool-1',
        toolName: 'a',
        startTimestamp: 3000,
        endTimestamp: 3500,
      });
      const tool2 = createMockToolNode({
        id: 'tool-2',
        toolName: 'b',
        startTimestamp: 1500,
        endTimestamp: 1600,
      });

      const result = partitionSpansByType([gen1, gen2, tool1, tool2] as any);

      // Sorted by end_timestamp: gen-1 (2100) before gen-2 (3000)
      expect(result.generationSpans.map(s => s.id)).toEqual(['gen-1', 'gen-2']);
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

    it('treats whitespace-only content as absent so no blank bubble renders', () => {
      const requestMessages = JSON.stringify([{role: 'user', content: '   '}]);
      const genNode = createMockNode({
        id: 'gen-1',
        startTimestamp: 1000,
        attributes: {
          [SpanFields.GEN_AI_REQUEST_MESSAGES]: requestMessages,
          [SpanFields.GEN_AI_RESPONSE_TEXT]: '\n\n',
        },
      });

      const turns = buildConversationTurns([genNode as any], []);

      expect(turns[0]?.userContent).toBeNull();
      expect(turns[0]?.assistantContent).toBeNull();
    });
  });

  describe('mergeEmptyTurns', () => {
    it('merges tool calls from empty turns into next turn', () => {
      const turns = [
        makeTurn({
          generation: {id: 'gen-1'} as any,
          userContent: 'Question 1',
          toolCalls: [{name: 'search', nodeId: 'tool-1', hasError: false}],
        }),
        makeTurn({
          generation: {id: 'gen-2'} as any,
          userContent: 'Question 2',
          assistantContent: 'Answer',
          toolCalls: [{name: 'calc', nodeId: 'tool-2', hasError: false}],
        }),
      ];

      const merged = mergeEmptyTurns(turns);

      expect(merged).toHaveLength(2);
      expect(merged[1]?.toolCalls).toHaveLength(2);
      expect(merged[1]?.toolCalls.map(t => t.name)).toEqual(['search', 'calc']);
    });

    it('chains multiple empty turns', () => {
      const turns = [
        makeTurn({
          generation: {id: 'gen-1'} as any,
          userContent: 'Q1',
          toolCalls: [{name: 'tool-a', nodeId: 't-1', hasError: false}],
        }),
        makeTurn({
          generation: {id: 'gen-2'} as any,
          toolCalls: [{name: 'tool-b', nodeId: 't-2', hasError: false}],
        }),
        makeTurn({
          generation: {id: 'gen-3'} as any,
          userContent: 'Q2',
          assistantContent: 'Final answer',
          toolCalls: [{name: 'tool-c', nodeId: 't-3', hasError: false}],
        }),
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

    it('flushes pending tool calls onto last turn when no subsequent turn has content', () => {
      const turns = [
        makeTurn({
          generation: {id: 'gen-1'} as any,
          userContent: 'Question',
          assistantContent: 'Answer',
        }),
        makeTurn({
          generation: {id: 'gen-2'} as any,
          toolCalls: [{name: 'search', nodeId: 'tool-1', hasError: false}],
        }),
      ];

      const merged = mergeEmptyTurns(turns);

      // The pending tool call should be flushed onto the last result turn
      expect(merged).toHaveLength(1);
      expect(merged[0]?.toolCalls).toHaveLength(1);
      expect(merged[0]?.toolCalls[0]?.name).toBe('search');
    });

    it('preserves user content turns even without assistant response', () => {
      const turns = [
        makeTurn({
          generation: {id: 'gen-1'} as any,
          userContent: 'Question without answer',
        }),
      ];

      const merged = mergeEmptyTurns(turns);

      expect(merged).toHaveLength(1);
      expect(merged[0]?.userContent).toBe('Question without answer');
    });
  });

  describe('turnsToMessages', () => {
    it('creates user and assistant messages from turns', () => {
      const turns = [
        makeTurn({
          generation: {
            id: 'gen-1',
            value: {start_timestamp: 1000, end_timestamp: 1100},
          } as any,
          userContent: 'Hello',
          assistantContent: 'Hi there',
          userEmail: 'user@example.com',
        }),
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

    // Same user text in two turns: collapse only for a cumulative tool loop.
    it.each([
      {
        name: 'collapses identical content in a cumulative history',
        turn1: {assistantContent: 'A1'},
        turn2: {assistantContent: 'A2'},
        users: 1,
      },
      {
        name: 'keeps a repeat when the cumulative user-message count grows',
        turn1: {assistantContent: 'A1', userMessageCount: 1},
        turn2: {assistantContent: 'A2', userMessageCount: 2},
        users: 2,
      },
      {
        name: 'keeps a repeat from non-cumulative single-message inputs',
        turn1: {assistantContent: 'A', hasInputHistory: false},
        turn2: {assistantContent: 'A', hasInputHistory: false},
        users: 2,
      },
      {
        name: 'collapses a repeat carried across a tool loop (stable count)',
        turn1: {
          toolCalls: [{name: 'weather', nodeId: 'tool-1', hasError: false}],
          userMessageCount: 1,
        },
        turn2: {assistantContent: 'A', userMessageCount: 1},
        users: 1,
      },
    ])('deduplicates user messages: $name', ({turn1, turn2, users}) => {
      const messages = turnsToMessages([
        makeTurn({
          generation: {
            id: 'gen-1',
            value: {start_timestamp: 1000, end_timestamp: 1100},
          } as any,
          userContent: 'Hello',
          ...turn1,
        }),
        makeTurn({
          generation: {
            id: 'gen-2',
            value: {start_timestamp: 2000, end_timestamp: 2100},
          } as any,
          userContent: 'Hello',
          ...turn2,
        }),
      ]);

      expect(messages.filter(m => m.role === 'user')).toHaveLength(users);
    });

    it('does not deduplicate user messages with different whitespace or case', () => {
      const turns = [
        makeTurn({
          generation: {
            id: 'gen-1',
            value: {start_timestamp: 1000, end_timestamp: 1100},
          } as any,
          userContent: 'Hello',
          assistantContent: 'Response 1',
        }),
        makeTurn({
          generation: {
            id: 'gen-2',
            value: {start_timestamp: 2000, end_timestamp: 2100},
          } as any,
          userContent: '  HELLO  ', // Different due to whitespace and case
          assistantContent: 'Response 2',
        }),
      ];

      const messages = turnsToMessages(turns);

      const userMessages = messages.filter(m => m.role === 'user');
      expect(userMessages).toHaveLength(2);
    });

    it('deduplicates assistant messages by exact content', () => {
      const turns = [
        makeTurn({
          generation: {
            id: 'gen-1',
            value: {start_timestamp: 1000, end_timestamp: 1100},
          } as any,
          userContent: 'Question 1',
          assistantContent: 'Same response',
        }),
        makeTurn({
          generation: {
            id: 'gen-2',
            value: {start_timestamp: 2000, end_timestamp: 2100},
          } as any,
          userContent: 'Question 2',
          assistantContent: 'Same response', // Exact same content
        }),
      ];

      const messages = turnsToMessages(turns);

      const assistantMessages = messages.filter(m => m.role === 'assistant');
      expect(assistantMessages).toHaveLength(1);
    });

    it('does not deduplicate [Filtered] messages across turns', () => {
      const turns = [
        makeTurn({
          generation: {
            id: 'gen-1',
            value: {start_timestamp: 1000, end_timestamp: 1100},
          } as any,
          userContent: '[Filtered]',
          assistantContent: '[Filtered]',
        }),
        makeTurn({
          generation: {
            id: 'gen-2',
            value: {start_timestamp: 2000, end_timestamp: 2100},
          } as any,
          userContent: '[Filtered]',
          assistantContent: '[Filtered]',
        }),
      ];

      const messages = turnsToMessages(turns);

      const userMessages = messages.filter(m => m.role === 'user');
      const assistantMessages = messages.filter(m => m.role === 'assistant');

      expect(userMessages).toHaveLength(2);
      expect(assistantMessages).toHaveLength(2);
    });

    function assistantFromAttributes(attributes: Record<string, string>) {
      const turns = [
        makeTurn({
          generation: {
            id: 'gen-1',
            value: {start_timestamp: 1000, end_timestamp: 1100},
            attributes,
          } as any,
          userContent: 'Hello',
          assistantContent: 'Hi',
        }),
      ];
      return turnsToMessages(turns).find(m => m.role === 'assistant');
    }

    it('resolves agentName from agent.name, then function_id, preferring agent.name', () => {
      expect(
        assistantFromAttributes({[SpanFields.GEN_AI_AGENT_NAME]: 'my-agent'})?.agentName
      ).toBe('my-agent');
      expect(
        assistantFromAttributes({[SpanFields.GEN_AI_FUNCTION_ID]: 'vercel-func'})
          ?.agentName
      ).toBe('vercel-func');
      expect(
        assistantFromAttributes({
          [SpanFields.GEN_AI_AGENT_NAME]: 'preferred-agent',
          [SpanFields.GEN_AI_FUNCTION_ID]: 'fallback-func',
        })?.agentName
      ).toBe('preferred-agent');
    });

    it('resolves modelName from gen_ai.response.model, undefined when unset', () => {
      expect(
        assistantFromAttributes({[SpanFields.GEN_AI_RESPONSE_MODEL]: 'gpt-4o'})?.modelName
      ).toBe('gpt-4o');
      const assistant = assistantFromAttributes({});
      expect(assistant?.agentName).toBeUndefined();
      expect(assistant?.modelName).toBeUndefined();
    });

    it('attaches tool calls to assistant messages', () => {
      const turns = [
        makeTurn({
          generation: {
            id: 'gen-1',
            value: {start_timestamp: 1000, end_timestamp: 1100},
          } as any,
          userContent: 'Question',
          assistantContent: 'Answer',
          toolCalls: [{name: 'search', nodeId: 'tool-1', hasError: false}],
        }),
      ];

      const messages = turnsToMessages(turns);

      const assistantMessage = messages.find(m => m.role === 'assistant');
      expect(assistantMessage?.toolCalls).toHaveLength(1);
      expect(assistantMessage?.toolCalls?.[0]?.name).toBe('search');
    });

    it('sorts messages by timestamp', () => {
      const turns = [
        makeTurn({
          generation: {
            id: 'gen-1',
            value: {start_timestamp: 2000, end_timestamp: 2100},
          } as any,
          userContent: 'Second',
          assistantContent: 'Second response',
        }),
        makeTurn({
          generation: {
            id: 'gen-2',
            value: {start_timestamp: 1000, end_timestamp: 1100},
          } as any,
          userContent: 'First',
          assistantContent: 'First response',
        }),
      ];

      const messages = turnsToMessages(turns);

      expect(messages[0]?.content).toBe('First');
      expect(messages[1]?.content).toBe('First response');
      expect(messages[2]?.content).toBe('Second');
      expect(messages[3]?.content).toBe('Second response');
    });

    it('creates assistant message for tool-call-only turns without text', () => {
      const turns = [
        makeTurn({
          generation: {
            id: 'gen-1',
            value: {start_timestamp: 1000, end_timestamp: 1100},
          } as any,
          userContent: 'Do something',
          toolCalls: [{name: 'search', nodeId: 'tool-1', hasError: false}],
        }),
      ];

      const messages = turnsToMessages(turns);

      const assistantMessages = messages.filter(m => m.role === 'assistant');
      expect(assistantMessages).toHaveLength(1);
      expect(assistantMessages[0]?.content).toBe('');
      expect(assistantMessages[0]?.toolCalls).toHaveLength(1);
      expect(assistantMessages[0]?.toolCalls?.[0]?.name).toBe('search');
    });

    it('does not create assistant message when no content and no tool calls', () => {
      const turns = [
        makeTurn({
          generation: {
            id: 'gen-1',
            value: {start_timestamp: 1000, end_timestamp: 1100},
          } as any,
          userContent: 'Hello',
        }),
      ];

      const messages = turnsToMessages(turns);

      const assistantMessages = messages.filter(m => m.role === 'assistant');
      expect(assistantMessages).toHaveLength(0);
    });

    it('keeps user→assistant pairing across back-to-back turns under one second apart', () => {
      // Turns complete within ~1s of each other; user is anchored at span
      // start, assistant at span end, so pairing must hold even when turns
      // are tightly packed.
      const turns = [
        makeTurn({
          generation: {
            id: 'gen-1',
            value: {start_timestamp: 0, end_timestamp: 1.1},
          } as any,
          userContent: 'Q1',
          assistantContent: 'A1',
        }),
        makeTurn({
          generation: {
            id: 'gen-2',
            value: {start_timestamp: 1.2, end_timestamp: 1.97},
          } as any,
          userContent: 'Q2',
          assistantContent: 'A2',
        }),
        makeTurn({
          generation: {
            id: 'gen-3',
            value: {start_timestamp: 2, end_timestamp: 2.64},
          } as any,
          userContent: 'Q3',
          assistantContent: 'A3',
        }),
      ];

      const messages = turnsToMessages(turns);

      expect(messages.map(m => m.content)).toEqual(['Q1', 'A1', 'Q2', 'A2', 'Q3', 'A3']);
    });

    it('attaches reasoning to the assistant message', () => {
      const turns = [
        makeTurn({
          userContent: 'Question',
          assistantContent: 'Answer',
          reasoning: 'Let me think step by step...',
        }),
      ];

      const assistant = turnsToMessages(turns).find(m => m.role === 'assistant');
      expect(assistant?.reasoning).toBe('Let me think step by step...');
    });

    it('creates an assistant message for reasoning-only turns without content or tool calls', () => {
      const turns = [
        makeTurn({
          userContent: 'Question',
          reasoning: 'Thinking only...',
        }),
      ];

      const messages = turnsToMessages(turns);
      const assistant = messages.find(m => m.role === 'assistant');
      expect(assistant).toBeDefined();
      expect(assistant?.content).toBe('');
      expect(assistant?.reasoning).toBe('Thinking only...');
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

    // Same question in two spans: collapse only for a cumulative tool loop.
    const Q = 'How is the weather in Vienna?';
    it.each([
      {
        name: 'collapses a last message replayed across a cumulative tool loop',
        input2: [
          {role: 'user', content: Q},
          {role: 'assistant', content: 'R1'},
        ],
        users: 1,
      },
      {
        name: 'keeps repeats from non-cumulative single-message inputs',
        input2: [{role: 'user', content: Q}],
        users: 2,
      },
      {
        name: 'keeps a repeat when the cumulative history gains a user message',
        input2: [
          {role: 'user', content: Q},
          {role: 'assistant', content: 'R1'},
          {role: 'user', content: Q},
        ],
        users: 2,
      },
    ])('user-message dedup end to end: $name', ({input2, users}) => {
      const node1 = createMockNode({
        id: 'span-1',
        startTimestamp: 1000,
        attributes: {
          [SpanFields.GEN_AI_INPUT_MESSAGES]: JSON.stringify([
            {role: 'user', content: Q},
          ]),
          [SpanFields.GEN_AI_RESPONSE_TEXT]: 'R1',
        },
      });
      const node2 = createMockNode({
        id: 'span-2',
        startTimestamp: 2000,
        attributes: {
          [SpanFields.GEN_AI_INPUT_MESSAGES]: JSON.stringify(input2),
          [SpanFields.GEN_AI_RESPONSE_TEXT]: 'R2',
        },
      });

      const messages = extractMessagesFromNodes([node1, node2] as any);

      expect(messages.filter(m => m.role === 'user')).toHaveLength(users);
    });

    it('keeps repeated user messages from non-cumulative inputs with a system prompt', () => {
      const sysInput = (userText: string) =>
        JSON.stringify([
          {role: 'system', content: 'You are helpful'},
          {role: 'user', content: userText},
        ]);

      const node1 = createMockNode({
        id: 'span-1',
        startTimestamp: 1000,
        attributes: {
          [SpanFields.GEN_AI_INPUT_MESSAGES]: sysInput(Q),
          [SpanFields.GEN_AI_RESPONSE_TEXT]: 'R1',
        },
      });
      const node2 = createMockNode({
        id: 'span-2',
        startTimestamp: 2000,
        attributes: {
          [SpanFields.GEN_AI_INPUT_MESSAGES]: sysInput(Q),
          [SpanFields.GEN_AI_RESPONSE_TEXT]: 'R2',
        },
      });

      const messages = extractMessagesFromNodes([node1, node2] as any);
      expect(messages.filter(m => m.role === 'user')).toHaveLength(2);
    });

    it('returns empty array for empty input', () => {
      expect(extractMessagesFromNodes([])).toEqual([]);
    });

    it('returns empty array when no generation spans', () => {
      const tool = createMockToolNode({id: 'tool-1', toolName: 'search'});
      expect(extractMessagesFromNodes([tool as any])).toEqual([]);
    });
  });

  describe('parseAssistantContent with reasoning', () => {
    it('extracts reasoning separately from content', () => {
      const messages = JSON.stringify([
        {
          role: 'assistant',
          parts: [
            {type: 'reasoning', content: 'Let me think...'},
            {type: 'text', text: 'The answer is 42'},
          ],
        },
      ]);
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_OUTPUT_MESSAGES]: messages,
        },
      });
      const result = parseAssistantContent(node as any);
      expect(result.content).toBe('The answer is 42');
      expect(result.reasoning).toBe('Let me think...');
    });

    it('returns null reasoning when no reasoning parts', () => {
      const messages = JSON.stringify([
        {role: 'assistant', parts: [{type: 'text', text: 'Just text'}]},
      ]);
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_OUTPUT_MESSAGES]: messages,
        },
      });
      const result = parseAssistantContent(node as any);
      expect(result.content).toBe('Just text');
      expect(result.reasoning).toBeNull();
    });

    it('returns reasoning even with no text content', () => {
      const messages = JSON.stringify([
        {
          role: 'assistant',
          parts: [
            {type: 'reasoning', content: 'Thinking only...'},
            {
              type: 'tool_call',
              toolCallId: 'tc-1',
              toolName: 'search',
              args: {},
            },
          ],
        },
      ]);
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_OUTPUT_MESSAGES]: messages,
        },
      });
      const result = parseAssistantContent(node as any);
      expect(result.content).toBeNull();
      expect(result.reasoning).toBe('Thinking only...');
    });

    it('does not fall through to gen_ai.response.object for reasoning-only output', () => {
      const messages = JSON.stringify([
        {role: 'assistant', parts: [{type: 'reasoning', content: 'Thinking only...'}]},
      ]);
      const node = createMockNode({
        id: 'node-1',
        attributes: {
          [SpanFields.GEN_AI_OUTPUT_MESSAGES]: messages,
          [SpanFields.GEN_AI_RESPONSE_OBJECT]: JSON.stringify([
            {
              role: 'assistant',
              parts: [{type: 'reasoning', content: 'Thinking only...'}],
            },
          ]),
        },
      });
      const result = parseAssistantContent(node as any);
      expect(result.content).toBeNull();
      expect(result.reasoning).toBe('Thinking only...');
    });
  });

  describe('messagesToMarkdown', () => {
    it('formats user messages with email', () => {
      const result = messagesToMarkdown([
        {
          id: 'user-1',
          role: 'user',
          content: 'Hello world',
          timestamp: 1000,
          nodeId: 'n1',
          userEmail: 'dev@example.com',
        },
      ]);
      expect(result).toBe('### dev@example.com\n\nHello world');
    });

    it('formats user messages without email as User', () => {
      const result = messagesToMarkdown([
        {
          id: 'user-1',
          role: 'user',
          content: 'Hello',
          timestamp: 1000,
          nodeId: 'n1',
        },
      ]);
      expect(result).toBe('### User\n\nHello');
    });

    it('formats assistant messages with model and duration', () => {
      const result = messagesToMarkdown([
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Here is the answer',
          timestamp: 1000,
          nodeId: 'n1',
          modelName: 'claude-sonnet-4-20250514',
          duration: 2.5,
        },
      ]);
      expect(result).toBe('### claude-sonnet-4-20250514 — 2.5s\n\nHere is the answer');
    });

    it('formats assistant messages with agent name', () => {
      const result = messagesToMarkdown([
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Done',
          timestamp: 1000,
          nodeId: 'n1',
          agentName: 'My Agent',
        },
      ]);
      expect(result).toBe('### My Agent\n\nDone');
    });

    it('includes tool calls', () => {
      const result = messagesToMarkdown([
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'I ran the tools',
          timestamp: 1000,
          nodeId: 'n1',
          toolCalls: [
            {name: 'bash', nodeId: 't1', hasError: false},
            {name: 'read', nodeId: 't2', hasError: false},
          ],
        },
      ]);
      expect(result).toContain('> Called tools: `bash`, `read`');
      expect(result).toContain('I ran the tools');
    });

    it('formats a full conversation with separators between messages', () => {
      const result = messagesToMarkdown([
        {
          id: 'user-1',
          role: 'user',
          content: 'What files?',
          timestamp: 1000,
          nodeId: 'n1',
          userEmail: 'dev@example.com',
        },
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Here they are',
          timestamp: 1001,
          nodeId: 'n1',
          modelName: 'gpt-4o',
          duration: 1.2,
        },
      ]);
      expect(result).toBe(
        [
          '### dev@example.com',
          '',
          'What files?',
          '',
          '---',
          '',
          '### gpt-4o — 1.2s',
          '',
          'Here they are',
        ].join('\n')
      );
    });

    it('returns empty string for empty messages', () => {
      expect(messagesToMarkdown([])).toBe('');
    });

    it('includes reasoning as a Thinking blockquote', () => {
      const result = messagesToMarkdown([
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'The answer is 42',
          timestamp: 1000,
          nodeId: 'n1',
          reasoning: 'Let me think step by step...',
        },
      ]);
      expect(result).toContain('> Thinking:');
      expect(result).toContain('> Let me think step by step...');
      expect(result).toContain('The answer is 42');
    });

    it('prefixes every line of multi-line reasoning with a blockquote marker', () => {
      const result = messagesToMarkdown([
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'Done',
          timestamp: 1000,
          nodeId: 'n1',
          reasoning: 'First I check the input.\nThen I compute the result.',
        },
      ]);
      expect(result).toContain(
        '> Thinking:\n> First I check the input.\n> Then I compute the result.'
      );
    });

    it('omits the Thinking blockquote when there is no reasoning', () => {
      const result = messagesToMarkdown([
        {
          id: 'assistant-1',
          role: 'assistant',
          content: 'The answer is 42',
          timestamp: 1000,
          nodeId: 'n1',
        },
      ]);
      expect(result).not.toContain('Thinking:');
    });
  });
});
