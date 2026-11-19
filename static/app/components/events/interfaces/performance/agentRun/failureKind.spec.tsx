import {getFailureKind} from './failureKind';

const base = {
  exceptionType: 'Error',
  exceptionValue: '',
  handled: true,
  location: 'tool' as const,
  raisedInRunSpan: false,
};

describe('getFailureKind', () => {
  it.each([
    [
      'a run limit',
      {exceptionType: 'SoftTimeLimitExceeded', location: 'agent' as const},
      'Hit a time limit',
    ],
    [
      'an error in a model call',
      {location: 'model_call' as const},
      'The model provider failed',
    ],
    [
      'a provider error raised outside a model call',
      {
        exceptionType: 'ProviderError',
        exceptionValue: 'AI provider error: invalid_response',
      },
      'The model provider failed',
    ],
    [
      'unparsable model output',
      {exceptionValue: 'Invalid structured output from the model'},
      "The model's output couldn't be parsed",
    ],
    [
      'a 5xx response',
      {exceptionType: 'HTTPError', exceptionValue: '502 Bad Gateway'},
      'A dependency failed',
    ],
    [
      'a rate limit',
      {exceptionType: 'McpProviderError', exceptionValue: 'status 429 Too Many Requests'},
      'A dependency failed',
    ],
    ['a network timeout', {exceptionType: 'httpx.ReadTimeout'}, 'A dependency failed'],
    [
      'a dropped connection',
      {exceptionValue: 'Connection reset by peer'},
      'A dependency failed',
    ],
    [
      'a 403 response',
      {exceptionType: 'HTTPStatusError', exceptionValue: '403 Forbidden'},
      'Access denied',
    ],
    [
      'a 404 response in a span without a tool span around it',
      {
        exceptionType: 'HTTPStatusError',
        exceptionValue: '404 Not Found',
        location: 'agent' as const,
      },
      "The tool rejected the model's input",
    ],
    [
      'a handled ValueError wrapped by the agent runtime',
      {exceptionType: 'MontyRuntimeError', exceptionValue: 'ValueError: Invalid field'},
      "The tool rejected the model's input",
    ],
    [
      'an error raised in the agent span itself',
      {exceptionType: 'StopIteration', location: 'agent' as const, raisedInRunSpan: true},
      "Error in the agent's code",
    ],
  ])('labels %s', (_name, signals, label) => {
    expect(getFailureKind({...base, ...signals})).toBe(label);
  });

  it.each([
    ['an unhandled ValueError in a tool', {exceptionType: 'ValueError', handled: false}],
    [
      'an error below the agent span',
      {exceptionType: 'LockError', location: 'agent' as const},
    ],
    [
      'a response that failed validation',
      {exceptionType: 'ValidationError', exceptionValue: '1 validation error'},
    ],
  ])('leaves out %s', (_name, signals) => {
    expect(getFailureKind({...base, ...signals})).toBeNull();
  });
});
