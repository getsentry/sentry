import * as React from 'react';
import {createMemoryHistory, RouteContextInterface} from 'react-router';

import {reactHooks} from 'sentry-test/reactTestingLibrary';

import useHistory from 'sentry/utils/useHistory';
import {RouteContext} from 'sentry/views/routeContext';

describe('useHistory', () => {
  it('returns the history object', function () {
    const {push, replace, go, goBack, goForward} = createMemoryHistory({});

    const wrapper = ({children}) => (
      <RouteContext.Provider
        value={
          {
            router: {push, replace, go, goBack, goForward},
          } as RouteContextInterface
        }
      >
        {children}
      </RouteContext.Provider>
    );
    const {result} = reactHooks.renderHook(() => useHistory(), {wrapper});

    reactHooks.act(() => {
      result.current;
    });
    expect(typeof result.current).toBe('object');
    expect(typeof result.current.push).toBe('function');
  });
});
