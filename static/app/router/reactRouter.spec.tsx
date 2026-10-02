import {parseAsString, useQueryState} from 'nuqs';

import {
  cleanup,
  renderWithoutProviders,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {
  createBrowserRouter,
  Link,
  Navigate,
  NuqsAdapter,
  Outlet,
  RouterProvider,
  useMatches,
  useParams,
} from 'sentry/router/reactRouter';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

function IssuePage() {
  const {orgId, issueId} = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [query, setQuery] = useQueryState('query', parseAsString);

  return (
    <div>
      <h1>
        {orgId}: issue {issueId}
      </h1>
      <output aria-label="Query">{query}</output>
      <output aria-label="Projects">{JSON.stringify(location.query.project)}</output>
      <Link to="/organizations/org-slug/issues/456/?query=linked&project=1">
        Next issue
      </Link>
      <button onClick={() => setQuery('updated', {history: 'push'})}>Update query</button>
      <button onClick={() => navigate(-1)}>Back</button>
      <button onClick={() => navigate(1)}>Forward</button>
      <button
        onClick={() =>
          navigate(
            {
              pathname: '/organizations/org-slug/issues/456/',
              query: {project: ['1', '2'], query: 'from navigation'},
              hash: '#details',
            },
            {state: {source: 'integration'}}
          )
        }
      >
        Open issue details
      </button>
    </div>
  );
}

function IssueLayout() {
  return (
    <NuqsAdapter defaultOptions={{shallow: false}}>
      <Outlet />
    </NuqsAdapter>
  );
}

function LoadedIssuePage() {
  const match = useMatches().find(({id}) => id === 'issue-details');

  return (
    <div>
      <output aria-label="Loader data">{JSON.stringify(match?.data)}</output>
      <output aria-label="Route handle">{JSON.stringify(match?.handle)}</output>
      <Link to="/organizations/org-slug/issues/456/">Next loaded issue</Link>
    </div>
  );
}

const routes = [
  {
    path: '/organizations/:orgId/',
    element: <IssueLayout />,
    children: [
      {path: 'issues/:issueId/', element: <IssuePage />},
      {path: 'legacy/', element: <Navigate to="../issues/123/" replace />},
    ],
  },
];

describe('React Router integration', () => {
  let router: ReturnType<typeof createBrowserRouter>;

  beforeEach(() => {
    window.history.replaceState(
      {},
      '',
      '/organizations/org-slug/issues/123/?query=initial&project=1'
    );
  });

  afterEach(() => {
    cleanup();
    router?.dispose();
    window.history.replaceState({}, '', '/');
  });

  it('keeps nested route params and query state in sync when following links', async () => {
    router = createBrowserRouter(routes);
    renderWithoutProviders(<RouterProvider router={router} />);

    expect(
      screen.getByRole('heading', {name: 'org-slug: issue 123'})
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Query')).toHaveTextContent('initial');

    await userEvent.click(screen.getByRole('link', {name: 'Next issue'}));

    expect(
      await screen.findByRole('heading', {name: 'org-slug: issue 456'})
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByLabelText('Query')).toHaveTextContent('linked')
    );
    expect(router.state.location.pathname).toBe('/organizations/org-slug/issues/456/');
    expect(window.location.search).toBe('?query=linked&project=1');
  });

  it('preserves unrelated query params and restores query state through browser history', async () => {
    router = createBrowserRouter(routes);
    renderWithoutProviders(<RouterProvider router={router} />);

    await userEvent.click(screen.getByRole('button', {name: 'Update query'}));

    await waitFor(() => {
      expect(new URLSearchParams(router.state.location.search).get('query')).toBe(
        'updated'
      );
    });
    expect(new URLSearchParams(window.location.search).get('project')).toBe('1');
    expect(router.state.location.pathname).toBe('/organizations/org-slug/issues/123/');
    expect(screen.getByLabelText('Query')).toHaveTextContent('updated');

    await userEvent.click(screen.getByRole('button', {name: 'Back'}));
    await waitFor(() => {
      expect(screen.getByLabelText('Query')).toHaveTextContent('initial');
      expect(new URLSearchParams(router.state.location.search).get('query')).toBe(
        'initial'
      );
    });

    await userEvent.click(screen.getByRole('button', {name: 'Forward'}));
    await waitFor(() => {
      expect(screen.getByLabelText('Query')).toHaveTextContent('updated');
      expect(new URLSearchParams(router.state.location.search).get('query')).toBe(
        'updated'
      );
    });
    expect(new URLSearchParams(window.location.search).get('project')).toBe('1');
  });

  it('supports Sentry query-object navigation with arrays, hashes, and location state', async () => {
    router = createBrowserRouter(routes);
    renderWithoutProviders(<RouterProvider router={router} />);

    await userEvent.click(screen.getByRole('button', {name: 'Open issue details'}));

    expect(
      await screen.findByRole('heading', {name: 'org-slug: issue 456'})
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Projects')).toHaveTextContent('["1","2"]');
    await waitFor(() =>
      expect(screen.getByLabelText('Query')).toHaveTextContent('from navigation')
    );
    expect(window.location.hash).toBe('#details');
    expect(router.state.location.state).toEqual({source: 'integration'});
  });

  it('exposes loader data and route handles through useMatches after navigation', async () => {
    router = createBrowserRouter([
      {
        path: '/organizations/:orgId/',
        element: <Outlet />,
        children: [
          {
            id: 'issue-details',
            path: 'issues/:issueId/',
            loader: ({params}) => Promise.resolve({issueId: params.issueId}),
            handle: {title: 'Issue details'},
            element: <LoadedIssuePage />,
            hydrateFallbackElement: <div>Loading issue</div>,
          },
        ],
      },
    ]);
    renderWithoutProviders(<RouterProvider router={router} />);

    expect(await screen.findByLabelText('Loader data')).toHaveTextContent(
      '{"issueId":"123"}'
    );
    expect(screen.getByLabelText('Route handle')).toHaveTextContent(
      '{"title":"Issue details"}'
    );

    await userEvent.click(screen.getByRole('link', {name: 'Next loaded issue'}));

    await waitFor(() =>
      expect(screen.getByLabelText('Loader data')).toHaveTextContent('{"issueId":"456"}')
    );
    expect(screen.getByLabelText('Route handle')).toHaveTextContent(
      '{"title":"Issue details"}'
    );
  });

  it('replaces legacy nested routes so back navigation skips the redirect', async () => {
    window.history.replaceState({}, '', '/organizations/org-slug/issues/456/');
    window.history.pushState({}, '', '/organizations/org-slug/legacy/');
    router = createBrowserRouter(routes);
    renderWithoutProviders(<RouterProvider router={router} />);

    expect(
      await screen.findByRole('heading', {name: 'org-slug: issue 123'})
    ).toBeInTheDocument();
    expect(router.state.historyAction).toBe('REPLACE');

    await userEvent.click(screen.getByRole('button', {name: 'Back'}));

    expect(
      await screen.findByRole('heading', {name: 'org-slug: issue 456'})
    ).toBeInTheDocument();
    expect(window.location.pathname).toBe('/organizations/org-slug/issues/456/');
  });
});
