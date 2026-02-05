import {mapAssertionFormErrors} from 'sentry/views/alerts/rules/uptime/assertionFormErrors';

describe('mapAssertionFormErrors', () => {
  it('returns null/undefined as-is', () => {
    expect(mapAssertionFormErrors(null)).toBeNull();
    expect(mapAssertionFormErrors(undefined)).toBeUndefined();
  });

  it('passes through responses without assertion errors', () => {
    const response = {url: ['Invalid URL']};
    expect(mapAssertionFormErrors(response)).toEqual({url: ['Invalid URL']});
  });

  it('handles direct assertion compilation errors (uptime alerts format)', () => {
    const response = {
      assertion: {
        error: 'compilation_error',
        details: 'Invalid JSON path expression: syntax error at position 5',
      },
    };

    expect(mapAssertionFormErrors(response)).toEqual({
      assertion: [
        'Compilation Error: Invalid JSON path expression: syntax error at position 5',
      ],
    });
  });

  it('handles direct assertion serialization errors (uptime alerts format)', () => {
    const response = {
      assertion: {
        error: 'serialization_error',
        details: 'unknown variant `invalid_op`, expected one of `and`, `or`',
      },
    };

    expect(mapAssertionFormErrors(response)).toEqual({
      assertion: [
        'Serialization Error: unknown variant `invalid_op`, expected one of `and`, `or`',
      ],
    });
  });

  it('handles nested assertion errors (detector forms format)', () => {
    const response = {
      dataSources: {
        assertion: {
          error: 'compilation_error',
          details:
            'JSONPath Parser Error:  --> 1:3\n  |\n1 | $[oooooo\n  |   ^---\n  |\n  = expected selector',
        },
      },
    };

    expect(mapAssertionFormErrors(response)).toEqual({
      assertion: [
        'Compilation Error: JSONPath Parser Error:  --> 1:3\n  |\n1 | $[oooooo\n  |   ^---\n  |\n  = expected selector',
      ],
    });
  });

  it('flattens dataSources fields to top level for FormModel error mapping', () => {
    const response = {
      dataSources: {
        assertion: {
          error: 'compilation_error',
          details: 'Invalid expression',
        },
        url: ['Invalid URL format'],
        method: ['Method is required'],
      },
    };

    expect(mapAssertionFormErrors(response)).toEqual({
      assertion: ['Compilation Error: Invalid expression'],
      url: ['Invalid URL format'],
      method: ['Method is required'],
    });
  });

  it('handles unknown error types with fallback title', () => {
    const response = {
      assertion: {
        error: 'unknown_error_type',
        details: 'Something went wrong',
      },
    };

    expect(mapAssertionFormErrors(response)).toEqual({
      assertion: ['Validation Error: Something went wrong'],
    });
  });

  it('does not modify assertion if already an array', () => {
    const response = {
      assertion: ['Already formatted error'],
    };

    expect(mapAssertionFormErrors(response)).toEqual({
      assertion: ['Already formatted error'],
    });
  });
});
