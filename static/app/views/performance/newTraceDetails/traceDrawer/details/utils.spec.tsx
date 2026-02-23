import {
  getTraceIssueSeverityClassName,
  parseJsonWithFix,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {
  makeEAPError,
  makeEAPOccurrence,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';

describe('parseJsonWithFix', () => {
  it('parses valid JSON without fixing', () => {
    const data = '{"name":"test","value":123}';
    const result = parseJsonWithFix(data);

    expect(result.fixedInvalidJson).toBe(false);
    expect(result.parsed).toEqual({name: 'test', value: 123});
  });

  it('fixes JSON truncated due to size limits mid-string', () => {
    const data = '{"message":"This is a very long message that got cut off du';
    const result = parseJsonWithFix(data);

    expect(result.fixedInvalidJson).toBe(true);
    expect(result.parsed).toEqual({
      message: 'This is a very long message that got cut off du~~',
    });
  });

  it('fixes JSON truncated due to size limits mid-array', () => {
    const data = '{"items":["item1","item2","item3","this is a very long ite';
    const result = parseJsonWithFix(data);

    expect(result.fixedInvalidJson).toBe(true);
    expect(result.parsed).toEqual({
      items: ['item1', 'item2', 'item3', 'this is a very long ite~~'],
    });
  });

  it('fixes truncations with ... marker', () => {
    const data =
      '[{"role":"user","content":"What is the capital?"},{"role":"assistant","content":"Paris is the capital of France. With an estimated population of 2,102,650 residents as of 1 January 2023...';
    const result = parseJsonWithFix(data);

    expect(result.fixedInvalidJson).toBe(true);
    expect(result.parsed).toEqual([
      {role: 'user', content: 'What is the capital?'},
      {
        role: 'assistant',
        content:
          'Paris is the capital of France. With an estimated population of 2,102,650 residents as of 1 January 2023...~~',
      },
    ]);
  });

  it('handles JSON with [Filtered] from data scrubbing', () => {
    const data = '[Filtered]';
    expect(() => parseJsonWithFix(data)).toThrow();
  });
});

describe('getTraceIssueSeverityClassName', () => {
  it('returns the level for error event_type', () => {
    const issue = makeEAPError({level: 'warning'});
    expect(getTraceIssueSeverityClassName(issue)).toBe('warning');
  });

  it('returns occurrence for non-error issues with non-error/fatal levels', () => {
    const issue = makeEAPOccurrence({level: 'warning'});
    expect(getTraceIssueSeverityClassName(issue)).toBe('occurrence');
  });

  it('treats undefined event_type as non-error (warning -> occurrence)', () => {
    const issue = {level: 'warning', event_type: undefined} as TraceTree.TraceIssue;
    expect(getTraceIssueSeverityClassName(issue)).toBe('occurrence');
  });

  it('treats undefined event_type as non-error (error -> error)', () => {
    const issue = {level: 'error', event_type: undefined} as TraceTree.TraceIssue;
    expect(getTraceIssueSeverityClassName(issue)).toBe('error');
  });

  it('returns fatal for occurrence issues with fatal level', () => {
    const issue = makeEAPOccurrence({level: 'fatal'});
    expect(getTraceIssueSeverityClassName(issue)).toBe('fatal');
  });

  it('returns occurrence for occurrence issues with info level', () => {
    const issue = makeEAPOccurrence({level: 'info'});
    expect(getTraceIssueSeverityClassName(issue)).toBe('occurrence');
  });
});
