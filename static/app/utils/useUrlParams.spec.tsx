import type {InjectedRouter} from 'react-router';
import {browserHistory} from 'react-router';
import type {Location} from 'history';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {RouteContext} from 'sentry/views/routeContext';

import useUrlParams from './useUrlParams';

jest.mock('react-router');

describe('useUrlParams', () => {
  type Params = {};
  type Query = {limit: number; page: number};
  const location = {
    query: {
      page: 3,
      limit: 50,
    },
  } as Location<Query>;
  const params = undefined;
  const router = {} as InjectedRouter<Params, Query>;
  const routes = [];
  const wrapper = ({children}) => (
    <RouteContext.Provider value={{location, params, router, routes}}>
      {children}
    </RouteContext.Provider>
  );

  it('should read query values from the url', () => {
    const {result} = reactHooks.renderHook(() => useUrlParams(), {wrapper});

    expect(result.current.getParamValue('page')).toBe(3);
    expect(result.current.getParamValue('limit')).toBe(50);
  });

  it('should read a specific query value if the defaultKey is passed along', () => {
    const {result} = reactHooks.renderHook(() => useUrlParams('page'), {wrapper});

    expect(result.current.getParamValue()).toBe(3);
  });

  it('should read the default value for the defaultKey', () => {
    const {result} = reactHooks.renderHook(() => useUrlParams('foo', 'bar'), {
      wrapper,
    });

    expect(result.current.getParamValue()).toBe('bar');
  });

  it('should update browser history with new values', () => {
    const {result} = reactHooks.renderHook(() => useUrlParams(), {wrapper});

    result.current.setParamValue('page', '4');

    expect(browserHistory.push).toHaveBeenCalledWith({
      query: {
        page: '4',
        limit: 50,
      },
    });
  });

  it('should update browser history with new values for the defaultKey', () => {
    const {result} = reactHooks.renderHook(() => useUrlParams('page'), {wrapper});

    result.current.setParamValue('4');

    expect(browserHistory.push).toHaveBeenCalledWith({
      query: {
        page: '4',
        limit: 50,
      },
    });
  });

  it('uses the same function reference after each render', () => {
    const {result, rerender} = reactHooks.renderHook(() => useUrlParams(), {wrapper});

    const firstResult = result.current;
    rerender();
    const secondResult = result.current;

    expect(firstResult.getParamValue).toBe(secondResult.getParamValue);
    expect(firstResult.setParamValue).toBe(secondResult.setParamValue);
  });
});
