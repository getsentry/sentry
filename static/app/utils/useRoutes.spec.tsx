import {createMemoryRouter, RouterProvider} from 'react-router-dom';

import {renderHook} from 'sentry-test/reactTestingLibrary';

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
          future={{v7_startTransition: true}}
        />
      ),
    });
    expect(result.current).toEqual([{path: '/'}]);
  });
});
