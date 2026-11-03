import {useLayoutEffect} from 'react';
import {createBrowserRouter, useLocation, type DataRouter} from 'react-router';
import {RouterProvider} from 'react-router/dom';
// eslint-disable-next-line no-restricted-imports
import {render} from '@testing-library/react';
import {parseAsString, useQueryState} from 'nuqs';

import {act, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {NuqsAdapter} from 'sentry/router/nuqsAdapter';

type Commit = {location: string | null; nuqs: string | null};

let router: DataRouter | undefined;

function renderWithBrowserRouter() {
  const commits: Commit[] = [];

  function Probe() {
    const location = useLocation();
    const [drawer, setDrawer] = useQueryState(
      'drawer',
      parseAsString.withOptions({history: 'push'})
    );
    const locationDrawer = new URLSearchParams(location.search).get('drawer');

    useLayoutEffect(() => {
      commits.push({location: locationDrawer, nuqs: drawer});
    });

    return (
      <button type="button" onClick={() => setDrawer('open')}>
        {drawer ?? 'closed'}
      </button>
    );
  }

  window.history.replaceState(null, '', '/');
  router = createBrowserRouter([
    {path: '/', element: <Probe />, children: [{path: 'a'}, {path: 'b'}]},
  ]);

  render(
    <NuqsAdapter defaultOptions={{shallow: false}}>
      <RouterProvider router={router} useTransitions={false} />
    </NuqsAdapter>
  );

  return {commits, router};
}

describe('NuqsAdapter', () => {
  afterEach(() => {
    router?.dispose();
  });

  it('commits query state with the router location when only the search changes', async () => {
    const {commits, router: browserRouter} = renderWithBrowserRouter();

    await act(() => browserRouter.navigate('/?drawer=open'));
    await screen.findByRole('button', {name: 'open'});
    await act(() => browserRouter.navigate(-1));
    await screen.findByRole('button', {name: 'closed'});
    await act(() => browserRouter.navigate(1));

    expect(await screen.findByRole('button', {name: 'open'})).toBeInTheDocument();
    expect(commits.filter(commit => commit.location !== commit.nuqs)).toEqual([]);
  });

  it('commits query state with the router location when the pathname changes', async () => {
    const {commits, router: browserRouter} = renderWithBrowserRouter();

    await act(() => browserRouter.navigate('/a?drawer=open'));
    await screen.findByRole('button', {name: 'open'});
    await act(() => browserRouter.navigate('/b'));
    await screen.findByRole('button', {name: 'closed'});
    await act(() => browserRouter.navigate(-1));

    expect(await screen.findByRole('button', {name: 'open'})).toBeInTheDocument();
    expect(commits.filter(commit => commit.location !== commit.nuqs)).toEqual([]);
  });

  it('commits query state with the router location when navigating around a query state write', async () => {
    const {commits, router: browserRouter} = renderWithBrowserRouter();

    await userEvent.click(screen.getByRole('button', {name: 'closed'}));
    await waitFor(() => expect(browserRouter.state.location.search).toBe('?drawer=open'));
    const commitsAfterWrite = commits.length;
    await act(() => browserRouter.navigate(-1));
    await screen.findByRole('button', {name: 'closed'});
    await act(() => browserRouter.navigate(1));

    expect(await screen.findByRole('button', {name: 'open'})).toBeInTheDocument();
    expect(browserRouter.state.location.search).toBe('?drawer=open');
    expect(
      commits.slice(commitsAfterWrite).filter(commit => commit.location !== commit.nuqs)
    ).toEqual([]);
  });
});
