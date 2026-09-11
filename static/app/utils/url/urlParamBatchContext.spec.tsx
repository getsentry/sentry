import debounce from 'lodash/debounce';

import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {
  UrlParamBatchProvider,
  useUrlBatchContext,
} from 'sentry/utils/url/urlParamBatchContext';

import {testableDebounce} from './testUtils';

jest.mock('lodash/debounce');

describe('UrlParamBatchProvider', () => {
  beforeEach(() => {
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

    const {result, router} = renderHookWithProviders(() => useUrlBatchContext(), {
      additionalWrapper: UrlParamBatchProvider,
      initialRouterConfig: {
        location: {pathname: '/'},
      },
    });
    const {batchUrlParamUpdates} = result.current;

    batchUrlParamUpdates({foo: 'bar'});
    batchUrlParamUpdates({potato: 'test'});

    act(() => jest.runAllTimers());

    expect(router.location.pathname).toBe('/');
    expect(router.location.query).toEqual({foo: 'bar', potato: 'test'});
  });
});
