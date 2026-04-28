import {createMemoryRouter, RouterProvider} from 'react-router-dom';

import {act, renderHook, waitFor} from 'sentry-test/reactTestingLibrary';

import {useRouter} from 'sentry/utils/useRouter';

describe('useRouter', () => {
  it('returns a router shim and supports navigation', async () => {
    const {result} = renderHook(() => useRouter(), {
      wrapper: ({children}) => (
        <RouterProvider
          router={createMemoryRouter(
            [
              {
                path: '/',
                children: [
                  {
                    path: 'projects/:projectId/',
                    handle: {path: '/projects/:projectId/'},
                    element: children,
                  },
                  {
                    path: 'issues/',
                    handle: {path: '/issues/'},
                    element: children,
                  },
                ],
              },
            ],
            {initialEntries: ['/projects/123/']}
          )}
          future={{v7_startTransition: true}}
        />
      ),
    });

    expect(result.current.location.pathname).toBe('/projects/123/');
    expect(result.current.params).toEqual({projectId: '123'});
    expect(typeof result.current.push).toBe('function');
    expect(typeof result.current.replace).toBe('function');
    expect(typeof result.current.go).toBe('function');

    act(() => {
      result.current.push('/issues/');
    });

    await waitFor(() => {
      expect(result.current.location.pathname).toBe('/issues/');
    });
  });
});
