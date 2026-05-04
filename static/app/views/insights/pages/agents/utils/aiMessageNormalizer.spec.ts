import {
  extractAssistantOutput,
  normalizeToMessages,
} from 'sentry/views/insights/pages/agents/utils/aiMessageNormalizer';

describe('normalizeToMessages', () => {
  describe('parts-format array', () => {
    it('collapses text parts across messages', () => {
      const input = JSON.stringify([
        {role: 'user', parts: [{type: 'text', content: 'Hello, world!'}]},
        {role: 'assistant', parts: [{type: 'text', text: 'Hi there!'}]},
      ]);

      const {messages, fixedInvalidJson} = normalizeToMessages(input, {
        defaultRole: 'user',
      });

      expect(fixedInvalidJson).toBe(false);
      expect(messages).toEqual([
        {role: 'user', content: 'Hello, world!'},
        {role: 'assistant', content: 'Hi there!'},
      ]);
    });

    it('concatenates multiple text parts within a single message', () => {
      const input = JSON.stringify([
        {
          role: 'user',
          parts: [
            {type: 'text', text: 'First part.'},
            {type: 'text', text: 'Second part.'},
          ],
        },
      ]);

      const {messages} = normalizeToMessages(input, {defaultRole: 'user'});

      expect(messages).toEqual([{role: 'user', content: 'First part.\nSecond part.'}]);
    });

    it('redacts file parts with a placeholder', () => {
      const input = JSON.stringify([
        {
          role: 'user',
          parts: [
            {type: 'text', text: 'See attached:'},
            {type: 'file', mime_type: 'image/png'},
          ],
        },
      ]);

      const {messages} = normalizeToMessages(input, {defaultRole: 'user'});

      expect(messages?.[0]?.content).toContain('See attached:');
      expect(messages?.[0]?.content).toContain('[redacted content of type "image/png"]');
    });

    it('falls back to object parts when no text is present', () => {
      const input = JSON.stringify([
        {
          role: 'assistant',
          parts: [{type: 'object', schema: 'x', data: {k: 'v'}}],
        },
      ]);

      const {messages} = normalizeToMessages(input, {defaultRole: 'assistant'});

      expect(messages?.[0]?.role).toBe('assistant');
      expect(messages?.[0]?.content).toEqual({
        type: 'object',
        schema: 'x',
        data: {k: 'v'},
      });
    });

    it('falls back to tool_calls when no text or object parts exist', () => {
      const input = JSON.stringify([
        {
          role: 'assistant',
          parts: [{type: 'tool_call', name: 'lookup', arguments: {q: 'foo'}}],
        },
      ]);

      const {messages} = normalizeToMessages(input, {defaultRole: 'assistant'});

      expect(messages?.[0]?.content).toEqual([
        {type: 'tool_call', name: 'lookup', arguments: {q: 'foo'}},
      ]);
    });
  });

  describe('content-format array', () => {
    it('passes through standard {role, content} messages', () => {
      const input = JSON.stringify([
        {role: 'system', content: 'You are helpful.'},
        {role: 'user', content: 'Hi!'},
      ]);

      const {messages} = normalizeToMessages(input, {defaultRole: 'user'});

      expect(messages).toEqual([
        {role: 'system', content: 'You are helpful.'},
        {role: 'user', content: 'Hi!'},
      ]);
    });

    it('extracts text from untyped {text} array items (legacy Anthropic shape)', () => {
      const input = JSON.stringify([{role: 'user', content: [{text: 'a'}, {text: 'b'}]}]);

      const {messages} = normalizeToMessages(input, {defaultRole: 'user'});

      expect(messages?.[0]?.content).toBe('a\nb');
    });

    it('extracts text from structured content arrays', () => {
      const input = JSON.stringify([
        {
          role: 'user',
          content: [
            {type: 'text', text: 'part one'},
            {type: 'text', text: 'part two'},
          ],
        },
      ]);

      const {messages} = normalizeToMessages(input, {defaultRole: 'user'});

      expect(messages?.[0]?.content).toBe('part one\npart two');
    });

    it('keeps tool role content as-is (not re-rendered)', () => {
      const input = JSON.stringify([
        {role: 'tool', content: [{type: 'text', text: 'result'}]},
      ]);

      const {messages} = normalizeToMessages(input, {defaultRole: 'user'});

      expect(messages?.[0]?.role).toBe('tool');
      expect(messages?.[0]?.content).toEqual([{type: 'text', text: 'result'}]);
    });

    it('drops messages that have no role and no content', () => {
      const input = JSON.stringify([{role: 'user', content: 'ok'}, {foo: 'bar'}]);

      const {messages} = normalizeToMessages(input, {defaultRole: 'user'});

      expect(messages).toEqual([{role: 'user', content: 'ok'}]);
    });

    it('defaults missing role to defaultRole', () => {
      const input = JSON.stringify([{content: 'floating message'}]);

      const {messages} = normalizeToMessages(input, {defaultRole: 'assistant'});

      expect(messages).toEqual([{role: 'assistant', content: 'floating message'}]);
    });
  });

  describe('{messages: ...} wrapper', () => {
    it('unwraps a direct array', () => {
      const input = JSON.stringify({
        messages: [{role: 'user', content: 'hi'}],
      });

      const {messages} = normalizeToMessages(input, {defaultRole: 'user'});

      expect(messages).toEqual([{role: 'user', content: 'hi'}]);
    });

    it('unwraps a stringified inner array (OpenRouter)', () => {
      const input = JSON.stringify({
        messages: JSON.stringify([{role: 'user', content: 'hi'}]),
      });

      const {messages} = normalizeToMessages(input, {defaultRole: 'user'});

      expect(messages).toEqual([{role: 'user', content: 'hi'}]);
    });

    it('prepends a system field when present', () => {
      const input = JSON.stringify({
        system: 'You are helpful.',
        messages: [{role: 'user', content: 'Hi!'}],
      });

      const {messages} = normalizeToMessages(input, {defaultRole: 'user'});

      expect(messages).toEqual([
        {role: 'system', content: 'You are helpful.'},
        {role: 'user', content: 'Hi!'},
      ]);
    });

    it('prepends a structured system field when present', () => {
      const input = JSON.stringify({
        system: {instructions: ['Be concise'], priority: 'high'},
        messages: [{role: 'user', content: 'Hi!'}],
      });

      const {messages} = normalizeToMessages(input, {defaultRole: 'user'});

      expect(messages).toEqual([
        {role: 'system', content: {instructions: ['Be concise'], priority: 'high'}},
        {role: 'user', content: 'Hi!'},
      ]);
    });
  });

  describe('legacy shapes', () => {
    it('expands {system, prompt} into two messages', () => {
      const input = JSON.stringify({system: 'sys', prompt: 'do the thing'});

      const {messages} = normalizeToMessages(input, {defaultRole: 'user'});

      expect(messages).toEqual([
        {role: 'system', content: 'sys'},
        {role: 'user', content: 'do the thing'},
      ]);
    });

    it('expands structured {system, prompt} into two messages', () => {
      const input = JSON.stringify({
        system: {instructions: ['Be concise'], priority: 'high'},
        prompt: 'do the thing',
      });

      const {messages} = normalizeToMessages(input, {defaultRole: 'user'});

      expect(messages).toEqual([
        {role: 'system', content: {instructions: ['Be concise'], priority: 'high'}},
        {role: 'user', content: 'do the thing'},
      ]);
    });

    it('expands {system, messages} into system + inner messages', () => {
      const input = JSON.stringify({
        system: 'sys',
        messages: [{role: 'user', content: 'hi'}],
      });

      const {messages} = normalizeToMessages(input, {defaultRole: 'user'});

      expect(messages).toEqual([
        {role: 'system', content: 'sys'},
        {role: 'user', content: 'hi'},
      ]);
    });

    it('yields a single user message when only prompt is provided', () => {
      const input = JSON.stringify({prompt: 'do the thing'});

      const {messages} = normalizeToMessages(input, {defaultRole: 'assistant'});

      expect(messages).toEqual([{role: 'user', content: 'do the thing'}]);
    });
  });

  describe('plain strings and edge cases', () => {
    it('wraps a plain string as a single defaultRole message', () => {
      const {messages} = normalizeToMessages('Hello', {defaultRole: 'user'});

      expect(messages).toEqual([{role: 'user', content: 'Hello'}]);
    });

    it('returns null for an empty string', () => {
      const {messages} = normalizeToMessages('', {defaultRole: 'user'});

      expect(messages).toBeNull();
    });

    it('returns null for whitespace', () => {
      const {messages} = normalizeToMessages('   \n\t  ', {defaultRole: 'user'});

      expect(messages).toBeNull();
    });

    it('returns null when everything is [Filtered]', () => {
      const {messages, fixedInvalidJson} = normalizeToMessages('[Filtered]', {
        defaultRole: 'user',
      });

      expect(messages).toBeNull();
      expect(fixedInvalidJson).toBe(true);
    });

    it('does not throw on malformed JSON with [Filtered]', () => {
      expect(() =>
        normalizeToMessages('[{"role":"user","content":[Filtered]}]', {
          defaultRole: 'user',
        })
      ).not.toThrow();
    });

    it('does not throw on truncated JSON', () => {
      expect(() =>
        normalizeToMessages('[{"role":"user","content":"hello \\', {defaultRole: 'user'})
      ).not.toThrow();
    });

    it('accepts a single {role, content} object (not wrapped in array)', () => {
      const input = JSON.stringify({role: 'user', content: 'hello'});

      const {messages} = normalizeToMessages(input, {defaultRole: 'assistant'});

      expect(messages).toEqual([{role: 'user', content: 'hello'}]);
    });
  });

  describe('cross-format tolerance', () => {
    it('accepts parts format on a field that traditionally held content format', () => {
      // Simulates: gen_ai.request.messages carrying the new parts shape.
      const input = JSON.stringify([{role: 'user', parts: [{type: 'text', text: 'hi'}]}]);

      const {messages} = normalizeToMessages(input, {defaultRole: 'user'});

      expect(messages).toEqual([{role: 'user', content: 'hi'}]);
    });

    it('accepts {system, prompt} legacy shape on a modern field', () => {
      // Simulates: gen_ai.request.messages carrying the legacy {system, prompt}.
      const input = JSON.stringify({system: 'sys', prompt: 'ask'});

      const {messages} = normalizeToMessages(input, {defaultRole: 'user'});

      expect(messages).toEqual([
        {role: 'system', content: 'sys'},
        {role: 'user', content: 'ask'},
      ]);
    });

    it('accepts plain string on a modern field', () => {
      const {messages} = normalizeToMessages('just a string', {defaultRole: 'user'});

      expect(messages).toEqual([{role: 'user', content: 'just a string'}]);
    });
  });
});

describe('extractAssistantOutput', () => {
  describe('parts-format array', () => {
    it('splits text, tool_calls, and object parts', () => {
      const input = JSON.stringify([
        {role: 'user', parts: [{type: 'text', text: 'q'}]},
        {
          role: 'assistant',
          parts: [
            {type: 'text', content: 'Here is the result.'},
            {type: 'tool_call', name: 'search', arguments: {q: 'x'}},
            {type: 'object', data: {k: 'v'}},
          ],
        },
      ]);

      const result = extractAssistantOutput(input, {defaultRole: 'assistant'});

      expect(result.responseText).toBe('Here is the result.');
      expect(JSON.parse(result.toolCalls!)).toEqual([
        {type: 'tool_call', name: 'search', arguments: {q: 'x'}},
      ]);
      expect(JSON.parse(result.responseObject!)).toEqual({
        type: 'object',
        data: {k: 'v'},
      });
    });

    it('joins text across multiple assistant messages', () => {
      const input = JSON.stringify([
        {role: 'assistant', parts: [{type: 'text', text: 'one'}]},
        {role: 'user', parts: [{type: 'text', text: 'mid'}]},
        {role: 'assistant', parts: [{type: 'text', text: 'two'}]},
      ]);

      const {responseText} = extractAssistantOutput(input, {defaultRole: 'assistant'});

      expect(responseText).toBe('one\ntwo');
    });

    it('returns multiple objects as an array when more than one is present', () => {
      const input = JSON.stringify([
        {
          role: 'assistant',
          parts: [
            {type: 'object', data: {a: 1}},
            {type: 'object', data: {b: 2}},
          ],
        },
      ]);

      const {responseObject} = extractAssistantOutput(input, {defaultRole: 'assistant'});

      expect(JSON.parse(responseObject!)).toEqual([
        {type: 'object', data: {a: 1}},
        {type: 'object', data: {b: 2}},
      ]);
    });
  });

  describe('content-format array', () => {
    it('extracts string content from assistant messages', () => {
      const input = JSON.stringify([
        {role: 'user', content: 'q'},
        {role: 'assistant', content: 'the answer'},
      ]);

      const {responseText} = extractAssistantOutput(input, {defaultRole: 'assistant'});

      expect(responseText).toBe('the answer');
    });

    it('treats object content as a response object', () => {
      const input = JSON.stringify([
        {role: 'assistant', content: {schema: 's', data: {k: 1}}},
      ]);

      const {responseObject, responseText} = extractAssistantOutput(input, {
        defaultRole: 'assistant',
      });

      expect(responseText).toBeNull();
      expect(JSON.parse(responseObject!)).toEqual({schema: 's', data: {k: 1}});
    });
  });

  describe('role selection', () => {
    it('filters to assistant when any message has a role', () => {
      const input = JSON.stringify([
        {role: 'user', content: 'ignored'},
        {role: 'assistant', content: 'picked'},
        {role: 'user', content: 'also ignored'},
      ]);

      const {responseText} = extractAssistantOutput(input, {defaultRole: 'assistant'});

      expect(responseText).toBe('picked');
    });

    it('falls back to the last message when no roles are present', () => {
      const input = JSON.stringify([
        {content: 'first'},
        {content: 'middle'},
        {content: 'last'},
      ]);

      const {responseText} = extractAssistantOutput(input, {defaultRole: 'assistant'});

      expect(responseText).toBe('last');
    });

    it('treats defaultRole-only messages as having no explicit role (last wins)', () => {
      // Bare content-only items get defaultRole='assistant' assigned in detection,
      // but selection should still treat them as role-less and take the last one.
      const input = JSON.stringify([{content: 'A'}, {content: 'B'}]);

      const {responseText} = extractAssistantOutput(input, {defaultRole: 'assistant'});

      expect(responseText).toBe('B');
    });
  });

  describe('plain strings and non-array inputs', () => {
    it('returns a plain string as responseText', () => {
      const result = extractAssistantOutput('just a response', {
        defaultRole: 'assistant',
      });

      expect(result.responseText).toBe('just a response');
      expect(result.responseObject).toBeNull();
      expect(result.toolCalls).toBeNull();
    });

    it('extracts content from a single {role, content} object', () => {
      const input = JSON.stringify({role: 'assistant', content: 'direct'});

      const {responseText} = extractAssistantOutput(input, {defaultRole: 'assistant'});

      expect(responseText).toBe('direct');
    });

    it('returns all null fields for empty input', () => {
      const result = extractAssistantOutput('', {defaultRole: 'assistant'});

      expect(result.responseText).toBeNull();
      expect(result.responseObject).toBeNull();
      expect(result.toolCalls).toBeNull();
    });

    it('does not throw on malformed JSON', () => {
      expect(() =>
        extractAssistantOutput('[Filtered]', {defaultRole: 'assistant'})
      ).not.toThrow();
    });
  });

  describe('cross-format tolerance', () => {
    it('accepts parts format on a field that typically held plain text', () => {
      // Simulates: gen_ai.response.text carrying a parts-format payload.
      const input = JSON.stringify([
        {role: 'assistant', parts: [{type: 'text', text: 'weird but ok'}]},
      ]);

      const {responseText} = extractAssistantOutput(input, {defaultRole: 'assistant'});

      expect(responseText).toBe('weird but ok');
    });

    it('accepts {messages: [...]} wrapper on an output field', () => {
      const input = JSON.stringify({
        messages: [{role: 'assistant', content: 'wrapped'}],
      });

      const {responseText} = extractAssistantOutput(input, {defaultRole: 'assistant'});

      expect(responseText).toBe('wrapped');
    });
  });
});
