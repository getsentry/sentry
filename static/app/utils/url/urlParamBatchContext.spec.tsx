import debounce from 'lodash/debounce';
import {LocationFixture} from 'sentry-fixture/locationFixture';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {testableDebounce} from 'sentry/utils/testableDebounce';
import {
  UrlParamBatchProvider,
  useUrlBatchContext,
} from 'sentry/utils/url/urlParamBatchContext';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');
jest.mock('lodash/debounce');

describe('UrlParamBatchProvider', () => {
  let mockNavigate: jest.Mock;

  beforeEach(() => {
    mockNavigate = jest.fn();
    jest.mocked(useNavigate).mockReturnValue(mockNavigate);
    jest.mocked(debounce).mockImplementation(testableDebounce);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should batch updates to the URL query params', () => {
    jest.mocked(useLocation).mockReturnValue(LocationFixture());
    const {result} = renderHook(() => useUrlBatchContext(), {
      wrapper: UrlParamBatchProvider,
    });
    const {batchUrlParamUpdates} = result.current;

    batchUrlParamUpdates({foo: 'bar'});
    batchUrlParamUpdates({potato: 'test'});

    jest.runAllTimers();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      expect.objectContaining({
        query: {foo: 'bar', potato: 'test'},
      }),
      {replace: true, preventScrollReset: true}
    );
  });
});
