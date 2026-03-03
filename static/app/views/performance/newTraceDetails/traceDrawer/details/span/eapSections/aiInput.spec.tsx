/**
 * Tests for transformPartsMessages – the function responsible for converting
 * the parts-based gen_ai message format into the standard content format.
 *
 * These tests cover the three distinct root-causes seen in production for the
 * "Error parsing gen_ai messages with parts format" issue (7270138341):
 *
 *  1. PII-filtered content: Relay replaces sensitive fields with the literal
 *     string `[Filtered]`, making the JSON unparseable.
 *  2. Bad escape sequences: some AI SDKs emit JSON with invalid backslash
 *     escapes (e.g. `\p`) that neither JSON.parse nor fixJson can repair.
 *  3. Happy-path: valid parts-format messages are transformed correctly.
 */

import {transformPartsMessages} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiInput';

describe('transformPartsMessages', () => {
  it('returns the transformed messages for a valid parts-format input', () => {
    const input = JSON.stringify([
      {
        role: 'user',
        parts: [{type: 'text', content: 'Hello, world!'}],
      },
      {
        role: 'assistant',
        parts: [{type: 'text', text: 'Hi there!'}],
      },
    ]);

    const {result, fixedInvalidJson} = transformPartsMessages(input);

    expect(fixedInvalidJson).toBe(false);
    expect(JSON.parse(result!)).toEqual([
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

    const {result} = transformPartsMessages(input);

    expect(JSON.parse(result!)).toEqual([
      {role: 'user', content: 'First part.\nSecond part.'},
    ]);
  });

  it('returns {result: undefined} when the top-level value is not an array', () => {
    const input = JSON.stringify({role: 'user', content: 'not an array'});
    const {result, fixedInvalidJson} = transformPartsMessages(input);

    expect(result).toBeUndefined();
    expect(fixedInvalidJson).toBe(false);
  });

  // ── Error cause 1: PII-filtered content ────────────────────────────────────

  it('does not throw when the entire value is [Filtered]', () => {
    // Relay replaces sensitive span attributes with the literal string "[Filtered]".
    // This string is not valid JSON ("Unexpected identifier 'Filtered'").
    expect(() => transformPartsMessages('[Filtered]')).not.toThrow();

    const {result, fixedInvalidJson} = transformPartsMessages('[Filtered]');
    expect(result).toBeUndefined();
    expect(fixedInvalidJson).toBe(true);
  });

  it('does not throw when [Filtered] appears inside a JSON message array', () => {
    // e.g. gen_ai.input.messages with a scrubbed content field:
    // [{"role":"user","content":[Filtered]}]
    const input = '[{"role":"user","content":[Filtered]}]';
    expect(() => transformPartsMessages(input)).not.toThrow();

    const {result, fixedInvalidJson} = transformPartsMessages(input);
    expect(result).toBeUndefined();
    expect(fixedInvalidJson).toBe(true);
  });

  it('does not throw when [Filtered] appears in a nested field', () => {
    const input = '[{"role":"assistant","parts":[{"type":"text","text":[Filtered]}]}]';
    expect(() => transformPartsMessages(input)).not.toThrow();
  });

  // ── Error cause 2: Bad escape sequences ────────────────────────────────────

  it('does not throw when the JSON contains an invalid escape sequence', () => {
    // Some AI SDKs (or user-provided content) emit strings like "bad \p escape"
    // where \p is not a valid JSON escape.  Neither JSON.parse nor fixJson can
    // repair this, so the function must gracefully fall back.
    const input = '{"message":"contains bad \\p escape"}';
    expect(() => transformPartsMessages(input)).not.toThrow();

    const {result, fixedInvalidJson} = transformPartsMessages(input);
    expect(result).toBeUndefined();
    expect(fixedInvalidJson).toBe(true);
  });

  it('does not throw for a truncated JSON that fixJson cannot repair', () => {
    // Artificially-truncated mid-escape to simulate an unrepairable string.
    const input = '[{"role":"user","content":"hello \\';
    expect(() => transformPartsMessages(input)).not.toThrow();
  });
});
