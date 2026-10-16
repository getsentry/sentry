import {createMemoryRouter} from 'react-router';

import {TestRouterProvider} from 'sentry-test/reactRouter';
import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useRoutes} from 'sentry/utils/useRoutes';

describe('useRoutes', () => {
  it('returns the current routes object', () => {
    const {result} = renderHook(() => useRoutes(), {
      wrapper: ({children}) => (
        <TestRouterProvider
          router={createMemoryRouter(
            [{path: '/', handle: {path: '/'}, element: children}],
            {initialEntries: ['/']}
          )}
        />
      ),
    });
    expect(result.current).toEqual([{path: '/'}]);
  });
});
