import {createMemoryRouter} from 'react-router';
import {RouterProvider} from 'react-router/dom';

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
          useTransitions={false}
        />
      ),
    });
    expect(result.current).toEqual([{path: '/'}]);
  });
});
