import {LocationFixture} from 'sentry-fixture/locationFixture';

import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useQueryParamState} from 'sentry/views/dashboards/widgetBuilder/hooks/useQueryParamState';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');

const mockedUseLocation = jest.mocked(useLocation);
const mockedUseNavigate = jest.mocked(useNavigate);

describe('useQueryParamState', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should get the initial value from the query param', () => {
    mockedUseLocation.mockReturnValue(
      LocationFixture({query: {testField: 'initial state'}})
    );

    const {result} = renderHook(() => useQueryParamState('testField'));

    expect(result.current[0]).toBe('initial state');
  });

  it('should update the local state and the query param', () => {
    const mockedNavigate = jest.fn();
    mockedUseNavigate.mockReturnValue(mockedNavigate);

    const {result} = renderHook(() => useQueryParamState('testField'));

    act(() => {
      result.current[1]('newValue');
    });

    // The local state should be updated
    expect(result.current[0]).toBe('newValue');

    // The query param should not be updated yet
    expect(mockedNavigate).not.toHaveBeenCalledWith({
      ...LocationFixture(),
      query: {testField: 'initial state'},
    });

    // Run the timers to trigger queued updates
    jest.runAllTimers();

    // The query param should be updated
    expect(mockedNavigate).toHaveBeenCalledWith({
      ...LocationFixture(),
      query: {testField: 'newValue'},
    });

    // The local state should be still reflect the new value
    expect(result.current[0]).toBe('newValue');
  });
});
