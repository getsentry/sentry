import debounce from 'lodash/debounce';

import {renderHook} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {
  UrlParamBatchProvider,
  useUrlBatchContext,
} from 'sentry/utils/url/urlParamBatchContext';
import {useNavigate} from 'sentry/utils/useNavigate';

import {testableDebounce} from './testUtils';

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
    setWindowLocation('http://localhost/');

    const {result} = renderHook(() => useUrlBatchContext(), {
      wrapper: UrlParamBatchProvider,
    });
    const {batchUrlParamUpdates} = result.current;

    batchUrlParamUpdates({foo: 'bar'});
    batchUrlParamUpdates({potato: 'test'});

    jest.runAllTimers();

    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith(
      {
        pathname: '/',
        query: {foo: 'bar', potato: 'test'},
      },
      {replace: true, preventScrollReset: true}
    );
  });
});
