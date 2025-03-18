import {LocationFixture} from 'sentry-fixture/locationFixture';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

import {UrlParamBatchProvider, useUrlBatchContext} from './urlParamBatchContext';

vi.mock('sentry/utils/useLocation');
vi.mock('sentry/utils/useNavigate');

describe('UrlParamBatchProvider', () => {
  let mockNavigate: vi.Mock;
  beforeEach(() => {
    mockNavigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate);
    vi.useRealTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  it('should batch updates to the URL query params', () => {
    vi.mocked(useLocation).mockReturnValue(LocationFixture());
    const {result} = renderHook(() => useUrlBatchContext(), {
      wrapper: UrlParamBatchProvider,
    });
    const {batchUrlParamUpdates} = result.current;

    act(() => {
      batchUrlParamUpdates({foo: 'bar'});
      batchUrlParamUpdates({potato: 'test'});
    });

    act(() => {
      vi.runAllTimers();
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
