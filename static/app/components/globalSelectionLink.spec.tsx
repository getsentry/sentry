import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GlobalSelectionLink from 'sentry/components/globalSelectionLink';

const path = '/some-path/';

describe('GlobalSelectionLink', () => {
  it('has global selection values in query', async () => {
    const query = {
      project: ['foo', 'bar'],
      environment: 'staging',
    };

    const {router} = render(
      <GlobalSelectionLink to={path}>Go somewhere!</GlobalSelectionLink>,
      {
        initialRouterConfig: {
          location: {pathname: '/', query},
        },
      }
    );

    expect(screen.getByText('Go somewhere!')).toHaveAttribute(
      'href',
      '/some-path/?environment=staging&project=foo&project=bar'
    );

    await userEvent.click(screen.getByText('Go somewhere!'));
    expect(router.location.pathname).toBe(path);
    expect(router.location.query).toEqual(query);
  });

  it('does not have global selection values in query', () => {
    render(<GlobalSelectionLink to={path}>Go somewhere!</GlobalSelectionLink>);

    expect(screen.getByText('Go somewhere!')).toHaveAttribute('href', path);
  });

  it('combines query parameters with custom query', async () => {
    const query = {
      project: ['foo', 'bar'],
      environment: 'staging',
    };
    const customQuery = {query: 'something'};

    const {router} = render(
      <GlobalSelectionLink to={{pathname: path, query: customQuery}}>
        Go somewhere!
      </GlobalSelectionLink>,
      {
        initialRouterConfig: {
          location: {pathname: '/', query},
        },
      }
    );

    await userEvent.click(screen.getByText('Go somewhere!'));
    expect(router.location.pathname).toBe(path);
    expect(router.location.query).toEqual({
      project: ['foo', 'bar'],
      environment: 'staging',
      query: 'something',
    });
  });

  it('combines query parameters with no query', async () => {
    const query = {
      project: ['foo', 'bar'],
      environment: 'staging',
    };

    const {router} = render(
      <GlobalSelectionLink to={{pathname: path}}>Go somewhere!</GlobalSelectionLink>,
      {
        initialRouterConfig: {
          location: {pathname: '/', query},
        },
      }
    );

    await userEvent.click(screen.getByText('Go somewhere!'));
    expect(router.location.pathname).toBe(path);
    expect(router.location.query).toEqual(query);
  });
});
