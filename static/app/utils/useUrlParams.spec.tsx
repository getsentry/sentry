import * as qs from 'query-string';

import {renderHook} from 'sentry-test/reactTestingLibrary';

import {browserHistory} from 'sentry/utils/browserHistory';

import useUrlParams from './useUrlParams';

jest.mock('react-router');

describe('useUrlParams', () => {
  beforeEach(() => {
    window.location.search = qs.stringify({
      page: '3',
      limit: '50',
      array: ['first', 'second'],
    });
  });

  it('should read query values from the url', () => {
    const {result} = renderHook(useUrlParams);

    expect(result.current.getParamValue('page')).toBe('3');
    expect(result.current.getParamValue('limit')).toBe('50');
    expect(result.current.getParamValue('array')).toBe('first');
    expect(result.current.getParamValue('foo')).toBeUndefined();
  });

  it('should read a specific query value if the defaultKey is passed along', () => {
    const {result} = renderHook((args: [string]) => useUrlParams(args[0]), {
      initialProps: ['page'],
    });

    expect(result.current.getParamValue()).toBe('3');
  });

  it('should read the default value for the defaultKey', () => {
    const {result} = renderHook(
      (args: [string, string]) => useUrlParams(args[0], args[1]),
      {
        initialProps: ['foo', 'bar'],
      }
    ); // Prefer TS function overloading, not initialProps

    expect(result.current.getParamValue()).toBe('bar');
  });

  it('should update browser history with new values', () => {
    const {result} = renderHook(useUrlParams);

    result.current.setParamValue('page', '4');

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/',
      query: {
        array: ['first', 'second'],
        page: '4',
        limit: '50',
      },
    });
  });

  it('should update browser history with new values for the defaultKey', () => {
    const {result} = renderHook((args: [string]) => useUrlParams(args[0]), {
      initialProps: ['page'],
    });

    result.current.setParamValue('4');

    expect(browserHistory.push).toHaveBeenCalledWith({
      pathname: '/',
      query: {
        array: ['first', 'second'],
        page: '4',
        limit: '50',
      },
    });
  });

  it('uses the same function reference after each render', () => {
    const {result, rerender} = renderHook(useUrlParams);

    const firstResult = result.current;
    rerender();
    const secondResult = result.current;

    expect(firstResult.getParamValue).toBe(secondResult.getParamValue);
    expect(firstResult.setParamValue).toBe(secondResult.setParamValue);
  });
});
