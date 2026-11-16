import {Suspense} from 'react';
import {createBrowserRouter, Outlet} from 'react-router';
import {RouterProvider} from 'react-router/dom';
import {ThemeProvider} from '@emotion/react';
import {render as renderWithoutProviders} from '@testing-library/react'; // eslint-disable-line no-restricted-imports

import {act, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Pagination} from '@sentry/scraps/pagination';
import {lightTheme} from '@sentry/scraps/theme';

import {NuqsAdapter} from 'sentry/router/nuqsAdapter';
import {ScrapsProviders} from 'sentry/scrapsProviders';

function PaginatedRoute() {
  return (
    <div>
      <h1>Loaded page</h1>
      <Pagination next={{cursor: 'next-page'}} />
    </div>
  );
}

it('settles lazy routes and paginates through the production Nuqs adapter', async () => {
  const initialUrl = window.location.href;
  window.history.replaceState(null, '', '/first?project=1&project=2');
  const router = createBrowserRouter([
    {
      hydrateFallbackElement: <div>Loading route</div>,
      element: (
        <ScrapsProviders>
          <Suspense fallback="Loading child">
            <Outlet />
          </Suspense>
        </ScrapsProviders>
      ),
      children: [
        {path: '/first', lazy: () => Promise.resolve({Component: PaginatedRoute})},
        {path: '/second', lazy: () => Promise.resolve({Component: PaginatedRoute})},
      ],
    },
  ]);
  const {unmount} = renderWithoutProviders(
    <ThemeProvider theme={lightTheme}>
      <NuqsAdapter defaultOptions={{shallow: false}}>
        <RouterProvider router={router} useTransitions={false} />
      </NuqsAdapter>
    </ThemeProvider>
  );
  try {
    expect(await screen.findByRole('heading', {name: 'Loaded page'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    await waitFor(() => {
      const search = new URLSearchParams(router.state.location.search);
      expect(search.getAll('project')).toEqual(['1', '2']);
      expect(search.get('cursor')).toBe('next-page');
    });
    await act(() => router.navigate('/second?project=2'));
    expect(await screen.findByRole('heading', {name: 'Loaded page'})).toBeInTheDocument();
    expect(screen.queryByText('Loading child')).not.toBeInTheDocument();
  } finally {
    unmount();
    router.dispose();
    window.history.replaceState(null, '', initialUrl);
  }
});
