import {useEffect} from 'react';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  AssertionFormError,
  createMapFormErrors,
  extractPreviewCheckError,
  mapPreviewCheckErrorToMessage,
  resolveErroredAssertionOp,
} from 'sentry/views/alerts/rules/uptime/formErrors';
import {
  CompilationErrorType,
  PreviewCheckErrorKind,
  UptimeComparisonType,
  type PreviewCheckError,
  type UptimeOp,
} from 'sentry/views/alerts/rules/uptime/types';

import {makeAndOp, makeStatusCodeOp} from './assertions/testUtils';
import {PreviewCheckResultProvider, usePreviewCheckResult} from './previewCheckContext';

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

describe('createMapFormErrors', () => {
  it('returns nonFieldErrors and calls setPreviewCheckError for assertion errors', () => {
    const ctx = makeContext();
    const mapFormErrors = createMapFormErrors(ctx);
    const body = {
      assertion: {
        error: PreviewCheckErrorKind.COMPILATION_ERROR,
        compileError: {
          type: CompilationErrorType.INVALID_JSON_PATH,
          msg: 'bad path',
          assertPath: ['0', '0'],
        },
      },
    };
    expect(mapFormErrors(body)).toEqual({
      nonFieldErrors: ['Failed to create monitor (Assertion Compilation Error)'],
    });
    expect(ctx.setPreviewCheckError).toHaveBeenCalledWith(body);
  });

  it('flattens dataSources fields to top level for non-assertion errors', () => {
    const ctx = makeContext();
    const mapFormErrors = createMapFormErrors(ctx);
    const body = {dataSources: {url: ['Enter a valid URL.']}};
    expect(mapFormErrors(body)).toEqual({url: ['Enter a valid URL.']});
  });
});

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

describe('AssertionFormError', () => {
  function renderWithProvider(
    op: UptimeOp,
    erroredOp: UptimeOp | undefined,
    initial: {data?: any; error?: PreviewCheckError | null} = {}
  ) {
    function Setter() {
      const previewCheckResult = usePreviewCheckResult();
      useEffect(() => {
        if ('data' in initial)
          previewCheckResult?.setPreviewCheckData(initial.data ?? null);
        if ('error' in initial)
          previewCheckResult?.setPreviewCheckError(initial.error ?? null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, []);
      return null;
    }
    return render(
      <PreviewCheckResultProvider>
        <Setter />
        <AssertionFormError op={op} erroredOp={erroredOp} />
      </PreviewCheckResultProvider>
    );
  }

  it('renders nothing when op ids do not match', () => {
    const op = makeStatusCodeOp();
    const otherOp = makeStatusCodeOp();
    const {container} = renderWithProvider(op, otherOp);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the error tooltip for an assertion failure', async () => {
    const op = makeStatusCodeOp();
    const data = {
      check_result: {assertion_failure_data: {root: makeAndOp({children: [op]})}},
    };
    renderWithProvider(op, op, {data});
    expect(await screen.findByText('Assertion Failed')).toBeInTheDocument();
  });

  it('renders the error tooltip for a compilation error', async () => {
    const error: PreviewCheckError = {
      assertion: {
        error: PreviewCheckErrorKind.COMPILATION_ERROR,
        compileError: {
          type: CompilationErrorType.INVALID_JSON_PATH,
          msg: 'bad path',
          assertPath: [],
        },
      },
    };
    const op = makeStatusCodeOp();
    renderWithProvider(op, op, {error});
    expect(await screen.findByText('Invalid JSON Path: bad path')).toBeInTheDocument();
  });
});
