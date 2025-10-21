import {LocationFixture} from 'sentry-fixture/locationFixture';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {
  UrlParamBatchProvider,
  useUrlBatchContext,
} from 'sentry/utils/url/urlParamBatchContext';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');

jest.mock('lodash/debounce', () =>
  jest.fn().mockImplementation((callback, timeout) => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    const debounced = jest.fn((...args) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => callback(...args), timeout);
    });

    const cancel = jest.fn(() => {
      if (timeoutId) clearTimeout(timeoutId);
    });

    const flush = jest.fn(() => {
      if (timeoutId) clearTimeout(timeoutId);
      callback();
    });

    // @ts-expect-error mock lodash debounce
    debounced.cancel = cancel;
    // @ts-expect-error mock lodash debounce
    debounced.flush = flush;
    return debounced;
  })
);

describe('UrlParamBatchProvider', () => {
  let mockNavigate: jest.Mock;
  beforeEach(() => {
    mockNavigate = jest.fn();
    jest.mocked(useNavigate).mockReturnValue(mockNavigate);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.clearAllTimers();
  });

  it('should batch updates to the URL query params', () => {
    jest.mocked(useLocation).mockReturnValue(LocationFixture());
    const {result} = renderHook(() => useUrlBatchContext(), {
      wrapper: UrlParamBatchProvider,
    });
    const {batchUrlParamUpdates} = result.current;

    act(() => {
      batchUrlParamUpdates({foo: 'bar'});
      batchUrlParamUpdates({potato: 'test'});
    });

    act(() => {
      jest.runAllTimers();
    });

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {foo: 'bar', potato: 'test'},
      }),
      {replace: true, preventScrollReset: true}
    );
  });
});
