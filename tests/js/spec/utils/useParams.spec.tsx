import * as React from 'react';
import {RouteContextInterface} from 'react-router';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useParams from 'sentry/utils/useParams';
import {RouteContext} from 'sentry/views/routeContext';

describe('useParams', () => {
  describe('when the path has no params', () => {
    it('returns an empty object', () => {
      const paramsProps = {};
      const wrapper = ({children}) => (
        <RouteContext.Provider
          value={
            {
              params: paramsProps,
            } as RouteContextInterface
          }
        >
          {children}
        </RouteContext.Provider>
      );
      const {result} = reactHooks.renderHook(() => useParams(), {wrapper});

      reactHooks.act(() => {
        result.current;
      });

      expect(result.current).toStrictEqual({
        ...paramsProps,
      });
    });
  });

  describe('when the path has some params', () => {
    it('returns an object of the URL params', () => {
      const paramsProps = {slug: 'react-router'};
      const wrapper = ({children}) => (
        <RouteContext.Provider
          value={
            {
              params: paramsProps,
            } as RouteContextInterface
          }
        >
          {children}
        </RouteContext.Provider>
      );
      const {result} = reactHooks.renderHook(() => useParams(), {wrapper});

      reactHooks.act(() => {
        result.current;
      });

      expect(result.current).toStrictEqual({
        ...paramsProps,
      });
    });
  });
});
