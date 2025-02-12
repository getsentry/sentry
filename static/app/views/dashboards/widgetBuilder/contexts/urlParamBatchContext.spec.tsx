import {LocationFixture} from 'sentry-fixture/locationFixture';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

import {UrlParamBatchProvider, useUrlBatchContext} from './urlParamBatchContext';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');

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
      {replace: true}
    );
  });
});
