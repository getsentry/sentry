import {browserHistory} from 'react-router';
import type {Location} from 'history';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';

import useUrlParams from './useUrlParams';

jest.mock('react-router');
jest.mock('sentry/utils/useLocation');

const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;
const mockBrowserHistoryPush = browserHistory.push as jest.MockedFunction<
  typeof browserHistory.push
>;

type Query = {limit: string; page: string};

describe('useUrlParams', () => {
  beforeEach(() => {
    mockBrowserHistoryPush.mockReset();
    mockUseLocation.mockReturnValue({
      query: {
        page: '3',
        limit: '50',
      },
    } as Location<Query>);
  });

  it('should read query values from the url', () => {
    const {result} = reactHooks.renderHook(useUrlParams);

    expect(result.current.getParamValue('page')).toBe('3');
    expect(result.current.getParamValue('limit')).toBe('50');
  });

  it('should read a specific query value if the defaultKey is passed along', () => {
    const {result} = reactHooks.renderHook((args: [string]) => useUrlParams(args[0]), {
      initialProps: ['page'],
    });

    expect(result.current.getParamValue()).toBe('3');
  });

  it('should read the default value for the defaultKey', () => {
    const {result} = reactHooks.renderHook(
      (args: [string, string]) => useUrlParams(args[0], args[1]),
      {
        initialProps: ['foo', 'bar'],
      }
    ); // Prefer TS function overloading, not initialProps

    expect(result.current.getParamValue()).toBe('bar');
  });

  it('should update browser history with new values', () => {
    const {result} = reactHooks.renderHook(useUrlParams);

    result.current.setParamValue('page', '4');

    expect(browserHistory.push).toHaveBeenCalledWith({
      query: {
        page: '4',
        limit: '50',
      },
    });
  });

  it('should update browser history with new values for the defaultKey', () => {
    const {result} = reactHooks.renderHook((args: [string]) => useUrlParams(args[0]), {
      initialProps: ['page'],
    });

    result.current.setParamValue('4');

    expect(browserHistory.push).toHaveBeenCalledWith({
      query: {
        page: '4',
        limit: '50',
      },
    });
  });

  it('uses the same function reference after each render', () => {
    const {result, rerender} = reactHooks.renderHook(useUrlParams);

    const firstResult = result.current;
    rerender();
    const secondResult = result.current;

    expect(firstResult.getParamValue).toBe(secondResult.getParamValue);
    expect(firstResult.setParamValue).toBe(secondResult.setParamValue);
  });
});
