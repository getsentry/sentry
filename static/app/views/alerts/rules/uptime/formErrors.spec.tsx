import {
  extractPreviewCheckError,
  mapPreviewCheckErrorToMessage,
  resolveErroredAssertionOp,
} from 'sentry/views/alerts/rules/uptime/formErrors';
import {
  CompilationErrorType,
  PreviewCheckErrorKind,
  UptimeComparisonType,
  type PreviewCheckError,
} from 'sentry/views/alerts/rules/uptime/types';

import {makeAndOp, makeStatusCodeOp} from './assertions/testUtils';

function makeContext({
  data = null,
  error = null,
}: {
  data?: any;
  error?: PreviewCheckError | null;
} = {}) {
  return {
    data,
    error,
    setPreviewCheckData: jest.fn(),
    setPreviewCheckError: jest.fn(),
    resetPreviewCheckResult: jest.fn(),
  };
}

describe('extractPreviewCheckError', () => {
  it('extracts error from direct format', () => {
    const body = {
      assertion: {
        error: 'compilation_error',
        compileError: {
          type: CompilationErrorType.INVALID_JSON_PATH,
          msg: 'bad path',
          assertPath: ['0', '0'],
        },
      },
    };
    expect(extractPreviewCheckError(body)).toBe(body);
  });

  it('extracts error from dataSources nested format', () => {
    const inner = {
      assertion: {
        error: 'compilation_error',
        compileError: {
          type: CompilationErrorType.INVALID_JSON_PATH,
          msg: 'bad path',
          assertPath: ['0', '0'],
        },
      },
    };
    const body = {dataSources: inner, unrelated: 'field'};
    expect(extractPreviewCheckError(body)).toBe(inner);
  });
});

describe('mapPreviewCheckErrorToMessage', () => {
  it('returns compilation error label', () => {
    const error: PreviewCheckError = {
      assertion: {
        error: PreviewCheckErrorKind.COMPILATION_ERROR,
        compileError: {
          type: CompilationErrorType.INVALID_JSON_PATH,
          msg: 'bad path',
          assertPath: ['0', '0'],
        },
      },
    };
    expect(mapPreviewCheckErrorToMessage(error)).toBe('Assertion Compilation Error');
  });

  it('returns serialization error label', () => {
    const error: PreviewCheckError = {
      assertion: {error: PreviewCheckErrorKind.SERIALIZATION_ERROR, details: 'bad op'},
    };
    expect(mapPreviewCheckErrorToMessage(error)).toBe('Assertion Serialization Error');
  });
});

describe('resolveErroredAssertionOp', () => {
  it('resolves errored op from assertion_failure_data by matching value', () => {
    const target = makeStatusCodeOp({
      value: 404,
      operator: {cmp: UptimeComparisonType.EQUALS},
    });
    const other = makeStatusCodeOp({
      value: 200,
      operator: {cmp: UptimeComparisonType.EQUALS},
    });
    const rootOp = makeAndOp({children: [other, target]});

    const failureRoot = makeAndOp({
      children: [
        makeStatusCodeOp({value: 404, operator: {cmp: UptimeComparisonType.EQUALS}}),
      ],
    });
    const data = {check_result: {assertion_failure_data: {root: failureRoot}}};

    expect(resolveErroredAssertionOp(makeContext({data}), rootOp)).toBe(target);
  });

  it('resolves errored op from assertPath in status_reason details', () => {
    const first = makeStatusCodeOp();
    const second = makeStatusCodeOp();
    const rootOp = makeAndOp({children: [first, second]});

    // assertPath ['0', '1'] → second child of root op's first child
    const data = {
      check_result: {
        assertion_failure_data: null,
        status_reason: {details: {assertPath: ['0', '1'], type: 'invalid_json_path'}},
      },
    };

    expect(resolveErroredAssertionOp(makeContext({data}), rootOp)).toBe(second);
  });

  it('resolves errored op from compilation error assertPath', () => {
    const first = makeStatusCodeOp();
    const second = makeStatusCodeOp();
    const rootOp = makeAndOp({children: [first, second]});

    const error: PreviewCheckError = {
      assertion: {
        error: PreviewCheckErrorKind.COMPILATION_ERROR,
        compileError: {
          type: CompilationErrorType.INVALID_JSON_PATH,
          msg: 'bad path',
          assertPath: ['0', '0'], // slice(1) = ['0'] → children[0] = first
        },
      },
    };

    expect(resolveErroredAssertionOp(makeContext({error}), rootOp)).toBe(first);
  });

  it('returns null for serialization errors (no assertPath available)', () => {
    const rootOp = makeAndOp({children: [makeStatusCodeOp()]});
    const error: PreviewCheckError = {
      assertion: {error: PreviewCheckErrorKind.SERIALIZATION_ERROR, details: 'bad op'},
    };

    expect(resolveErroredAssertionOp(makeContext({error}), rootOp)).toBeNull();
  });
});
