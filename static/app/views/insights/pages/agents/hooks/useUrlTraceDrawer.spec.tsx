import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useUrlTraceDrawer} from 'sentry/views/insights/pages/agents/hooks/useUrlTraceDrawer';

const mockSetTraceDrawerQueryState = jest.fn();
const mockOpenDrawer = jest.fn();
const mockCloseDrawer = jest.fn();

jest.mock('sentry/components/globalDrawer', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    openDrawer: mockOpenDrawer,
    closeDrawer: mockCloseDrawer,
    isDrawerOpen: false,
    panelRef: {current: null},
  })),
}));

jest.mock('sentry/views/insights/pages/agents/utils/urlParams', () => {
  const actual = jest.requireActual(
    'sentry/views/insights/pages/agents/utils/urlParams'
  );
  return {
    ...actual,
    useTraceDrawerQueryState: () => [
      {traceId: null, spanId: null, timestamp: null},
      mockSetTraceDrawerQueryState,
    ],
  };
});

describe('useUrlTraceDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('omits undefined spanId from URL state', () => {
    const {result} = renderHook(() => useUrlTraceDrawer());

    act(() => {
      result.current.openDrawer(jest.fn(), {
        traceSlug: 'trace-123',
        spanId: undefined,
        timestamp: 123,
      });
    });

    expect(mockSetTraceDrawerQueryState).toHaveBeenCalledWith({
      traceId: 'trace-123',
      spanId: null,
      timestamp: 123,
    });
  });
});
