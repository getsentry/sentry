import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GlobalSelectionLink from 'sentry/components/globalSelectionLink';

const path = '/some-path/';

describe('GlobalSelectionLink', () => {
  const getRouter = (query?: {environment: string; project: string[]}) =>
    RouterFixture({location: {query}});

  it('has global selection values in query', async () => {
    const query = {
      project: ['foo', 'bar'],
      environment: 'staging',
    };
    const router = getRouter(query);

    render(<GlobalSelectionLink to={path}>Go somewhere!</GlobalSelectionLink>, {
      router,
      deprecatedRouterMocks: true,
    });
    expect(screen.getByText('Go somewhere!')).toHaveAttribute(
      'href',
      '/some-path/?environment=staging&project=foo&project=bar'
    );

    await userEvent.click(screen.getByText('Go somewhere!'));
    expect(router.push).toHaveBeenCalledWith({pathname: path, query});
  });

  it('does not have global selection values in query', () => {
    render(<GlobalSelectionLink to={path}>Go somewhere!</GlobalSelectionLink>, {
      router: getRouter(),
      deprecatedRouterMocks: true,
    });

    expect(screen.getByText('Go somewhere!')).toHaveAttribute('href', path);
  });

  it('combines query parameters with custom query', async () => {
    const query = {
      project: ['foo', 'bar'],
      environment: 'staging',
    };
    const router = getRouter(query);
    const customQuery = {query: 'something'};
    render(
      <GlobalSelectionLink to={{pathname: path, query: customQuery}}>
        Go somewhere!
      </GlobalSelectionLink>,
      {
        router,
        deprecatedRouterMocks: true,
      }
    );

    await userEvent.click(screen.getByText('Go somewhere!'));
    expect(router.push).toHaveBeenCalledWith({
      pathname: path,
      query: {project: ['foo', 'bar'], environment: 'staging', query: 'something'},
    });
  });

  it('combines query parameters with no query', async () => {
    const query = {
      project: ['foo', 'bar'],
      environment: 'staging',
    };
    const router = getRouter(query);
    render(
      <GlobalSelectionLink to={{pathname: path}}>Go somewhere!</GlobalSelectionLink>,
      {
        router,
        deprecatedRouterMocks: true,
      }
    );

    await userEvent.click(screen.getByText('Go somewhere!'));

    expect(router.push).toHaveBeenCalledWith({pathname: path, query});
  });
});
