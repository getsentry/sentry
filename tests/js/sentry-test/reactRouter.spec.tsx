import {createRoot} from 'react-dom/client';
import {createBrowserRouter} from 'react-router';
import {ThemeProvider} from '@emotion/react';
import {parseAsString, useQueryState} from 'nuqs';
import {NuqsAdapter} from 'nuqs/adapters/react-router/v6';
import {ThemeFixture} from 'sentry-fixture/theme';

import {TestRouterProvider} from 'sentry-test/reactRouter';
import {act, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {Button} from '@sentry/scraps/button';

function QueryState({shallow}: {shallow: boolean}) {
  const [query, setQuery] = useQueryState(
    'query',
    parseAsString.withOptions({shallow, history: 'push'})
  );
  return (
    <div>
      <p>Query: {query}</p>
      <Button onClick={() => setQuery('updated')}>Update query</Button>
    </div>
  );
}

describe('Nuqs browser router adapter', () => {
  it.each([true, false])(
    'updates URL state and handles back with shallow=%s',
    async shallow => {
      const initialUrl = window.location.href;
      window.history.replaceState(null, '', '/query-state?query=initial');
      const router = createBrowserRouter([
        {
          path: '/query-state',
          element: (
            <NuqsAdapter>
              <QueryState shallow={shallow} />
            </NuqsAdapter>
          ),
        },
      ]);
      const container = document.createElement('div');
      document.body.append(container);
      const root = createRoot(container);

      try {
        act(() =>
          root.render(
            <ThemeProvider theme={ThemeFixture()}>
              <TestRouterProvider router={router} />
            </ThemeProvider>
          )
        );
        expect(screen.getByText('Query: initial')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', {name: 'Update query'}));
        expect(await screen.findByText('Query: updated')).toBeInTheDocument();
        await waitFor(() => expect(window.location.search).toBe('?query=updated'));
        await waitFor(() =>
          expect(router.state.location.search).toBe(
            shallow ? '?query=initial' : '?query=updated'
          )
        );

        act(() => {
          router.navigate(-1);
        });
        expect(await screen.findByText('Query: initial')).toBeInTheDocument();
        expect(window.location.search).toBe('?query=initial');
      } finally {
        act(() => root.unmount());
        router.dispose();
        container.remove();
        window.history.replaceState(null, '', initialUrl);
      }
    }
  );
});
