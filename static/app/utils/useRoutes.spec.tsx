import {renderHook} from 'sentry-test/reactTestingLibrary';

import {createMemoryRouter, RouterProvider} from 'sentry/router/reactRouter';
import {useRoutes} from 'sentry/utils/useRoutes';

describe('useRoutes', () => {
  it('returns the current routes object', () => {
    const {result} = renderHook(() => useRoutes(), {
      wrapper: ({children}) => (
        <RouterProvider
          router={createMemoryRouter(
            [{path: '/', handle: {path: '/'}, element: children}],
            {initialEntries: ['/']}
          )}
          useTransitions={false}
        />
      ),
    });
    expect(result.current).toEqual([{path: '/'}]);
  });
});
