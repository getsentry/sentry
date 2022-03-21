import * as React from 'react';
import {RouteContextInterface} from 'react-router';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useLocation from 'sentry/utils/useLocation';
import {RouteContext} from 'sentry/views/routeContext';

describe('useLocation', () => {
  it('returns the current location object', function () {
    const locationProps = {
      action: 'PUSH',
      hash: '',
      key: 'kkshof',
      pathname: '/settings/petal/integrations/',
      query: {hello: null},
      search: '?hello',
      state: undefined,
    };
    const wrapper = ({children}) => (
      <RouteContext.Provider
        value={
          {
            location: locationProps,
          } as RouteContextInterface
        }
      >
        {children}
      </RouteContext.Provider>
    );
    const {result} = reactHooks.renderHook(() => useLocation(), {wrapper});

    reactHooks.act(() => {
      result.current;
    });

    expect(result.current).toStrictEqual({
      ...locationProps,
    });
  });
});
