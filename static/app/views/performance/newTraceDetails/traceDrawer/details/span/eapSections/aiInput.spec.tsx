import * as Sentry from '@sentry/react';

import {
  parseAIMessages,
  transformPrompt,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiInput';

jest.mock('@sentry/react', () => ({
  captureException: jest.fn(),
}));

describe('aiInput parsing helpers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('normalizes valid AI message payloads', () => {
    const rawPayload = JSON.stringify([
      {role: 'system', content: [{type: 'text', text: ' Hello world '}], extra: 'ignored'},
      {role: 'tool', content: {result: {foo: 'bar'}}},
      {role: 'user'},
    ]);

    const parsed = parseAIMessages(rawPayload);

    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toEqual([
      {role: 'system', content: 'Hello world'},
      {role: 'tool', content: {result: {foo: 'bar'}}},
    ]);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });

  it('returns the original payload string when it is not an array', () => {
    const invalidPayload = '{"role":"system"}';

    const parsed = parseAIMessages(invalidPayload);

    expect(parsed).toBe(invalidPayload);
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
  });

  it('preserves the system message when nested messages cannot be parsed', () => {
    const prompt = JSON.stringify({
      system: 'stay safe',
      messages: 'not-json',
    });

    const transformed = transformPrompt(prompt);

    expect(typeof transformed).toBe('string');
    expect(Sentry.captureException).toHaveBeenCalledTimes(1);

    const normalized = parseAIMessages(transformed!);
    expect(Array.isArray(normalized)).toBe(true);
    expect(normalized).toEqual([
      {role: 'system', content: 'stay safe'},
      {role: 'user', content: 'not-json'},
    ]);
  });
});
