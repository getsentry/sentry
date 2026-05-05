import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {RequestError} from 'sentry/utils/requestError/requestError';
import type {TraceQueryResult} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {TraceWaterfallState} from 'sentry/views/performance/newTraceDetails/traceWaterfallState';

const mockUseFeedbackForm = jest.fn();

jest.mock('sentry/utils/useFeedbackForm', () => ({
  get useFeedbackForm() {
    return mockUseFeedbackForm;
  },
}));

const mockUseTraceQueryParamsMock = jest.fn();

jest.mock('sentry/views/performance/newTraceDetails/useTraceQueryParams', () => ({
  get useTraceQueryParams() {
    return mockUseTraceQueryParamsMock;
  },
}));

function createTraceQuery(overrides: Partial<{timestamp: number | undefined}>) {
  return {
    start: undefined,
    end: undefined,
    statsPeriod: undefined,
    timestamp: undefined,
    ...overrides,
  };
}

function createTraceResult(partial: Partial<TraceQueryResult>) {
  return {
    failureCount: 0,
    ...partial,
  } as TraceQueryResult;
}

describe('TraceWaterfallState', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFeedbackForm.mockReturnValue(jest.fn());
    mockUseTraceQueryParamsMock.mockReturnValue(createTraceQuery({}));
  });

  describe('Loading', () => {
    it('shows assembling message when the trace has no failures', () => {
      const trace = createTraceResult({failureCount: 0});

      render(<TraceWaterfallState.Loading trace={trace} />);

      expect(screen.getByText('Assembling the trace')).toBeInTheDocument();
    });

    it('shows retry message when the trace has failures', () => {
      const trace = createTraceResult({failureCount: 1});

      render(<TraceWaterfallState.Loading trace={trace} />);

      expect(
        screen.getByText('Failed to load the trace, trying again')
      ).toBeInTheDocument();
    });
  });

  describe('Error', () => {
    it.each([400, 500])(
      'shows invalid-request copy when the error status is %s',
      status => {
        const trace = createTraceResult({error: {status} as RequestError});

        render(<TraceWaterfallState.Error trace={trace} />);

        expect(screen.getByText(/The request was invalid/i)).toBeInTheDocument();
      }
    );

    it('shows not-found copy when the error status is 404', () => {
      const trace = createTraceResult({error: {status: 404} as RequestError});

      render(<TraceWaterfallState.Error trace={trace} />);

      expect(screen.getByText(/Couldn't find this trace/i)).toBeInTheDocument();
    });

    it.each([429, 504])('shows timeout copy when the error status is %s', status => {
      const trace = createTraceResult({error: {status} as RequestError});

      render(<TraceWaterfallState.Error trace={trace} />);

      expect(screen.getByText(/Query timed out/i)).toBeInTheDocument();
    });

    it('shows generic copy when the error status is not handled specially', () => {
      const trace = createTraceResult({error: {status: 418} as RequestError});

      render(<TraceWaterfallState.Error trace={trace} />);

      expect(screen.getByText('Woof, we failed to load your trace')).toBeInTheDocument();
      expect(screen.getByText(/Seeing this often/i)).toBeInTheDocument();
    });

    it('uses a mailto feedback link when the feedback form is unavailable', () => {
      mockUseFeedbackForm.mockReturnValue(null);
      const trace = createTraceResult({error: {status: 418} as RequestError});

      render(<TraceWaterfallState.Error trace={trace} />);

      expect(screen.getByRole('link', {name: 'Send us feedback'})).toHaveAttribute(
        'href',
        'mailto:support@sentry.io?subject=Trace%20fails%20to%20load'
      );
    });

    it('uses an in-app feedback link when the feedback form is available', () => {
      mockUseFeedbackForm.mockReturnValue(jest.fn());
      const trace = createTraceResult({error: {status: 418} as RequestError});

      render(<TraceWaterfallState.Error trace={trace} />);

      expect(screen.getByRole('link', {name: 'Send us feedback'})).toHaveAttribute(
        'href',
        '#'
      );
    });
  });

  describe('Empty', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('shows processing message when the trace timestamp is within the last ten minutes', () => {
      const timestamp = Math.floor((Date.now() - 5 * 60 * 1000) / 1000);
      mockUseTraceQueryParamsMock.mockReturnValue(createTraceQuery({timestamp}));

      render(<TraceWaterfallState.Empty />);

      expect(screen.getByText(/still processing this trace/i)).toBeInTheDocument();
    });

    it('shows no-spans message when the trace timestamp is older than ten minutes', () => {
      const timestamp = Math.floor((Date.now() - 11 * 60 * 1000) / 1000);
      mockUseTraceQueryParamsMock.mockReturnValue(createTraceQuery({timestamp}));

      render(<TraceWaterfallState.Empty />);

      expect(screen.getByText(/unable to find any spans/i)).toBeInTheDocument();
    });

    it('shows no-spans message when there is no timestamp', () => {
      mockUseTraceQueryParamsMock.mockReturnValue(
        createTraceQuery({timestamp: undefined})
      );

      render(<TraceWaterfallState.Empty />);

      expect(screen.getByText(/unable to find any spans/i)).toBeInTheDocument();
    });
  });
});
