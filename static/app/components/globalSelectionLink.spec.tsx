import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';
import {RouterFixture} from 'sentry-fixture/routerFixture';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GlobalSelectionLink from 'sentry/components/globalSelectionLink';

const path = 'http://some.url/';

describe('GlobalSelectionLink', function () {
  const getContext = (query?: {environment: string; project: string[]}) =>
    RouterContextFixture([
      {
        router: RouterFixture({
          location: {query},
        }),
      },
    ]);

  it('has global selection values in query', async function () {
    const query = {
      project: ['foo', 'bar'],
      environment: 'staging',
    };
    const context = getContext(query);

    render(<GlobalSelectionLink to={path}>Go somewhere!</GlobalSelectionLink>, {context});
    expect(screen.getByText('Go somewhere!')).toHaveAttribute(
      'href',
      'http://some.url/?environment=staging&project=foo&project=bar'
    );

    await userEvent.click(screen.getByText('Go somewhere!'));
    expect(context.context.router.push).toHaveBeenCalledWith({pathname: path, query});
  });

  it('does not have global selection values in query', function () {
    render(<GlobalSelectionLink to={path}>Go somewhere!</GlobalSelectionLink>, {
      context: getContext(),
    });

    expect(screen.getByText('Go somewhere!')).toHaveAttribute('href', path);
  });

  it('combines query parameters with custom query', async function () {
    const query = {
      project: ['foo', 'bar'],
      environment: 'staging',
    };
    const context = getContext(query);
    const customQuery = {query: 'something'};
    render(
      <GlobalSelectionLink to={{pathname: path, query: customQuery}}>
        Go somewhere!
      </GlobalSelectionLink>,
      {context}
    );

    await userEvent.click(screen.getByText('Go somewhere!'));
    expect(context.context.router.push).toHaveBeenCalledWith({
      pathname: path,
      query: {project: ['foo', 'bar'], environment: 'staging', query: 'something'},
    });
  });

  it('combines query parameters with no query', async function () {
    const query = {
      project: ['foo', 'bar'],
      environment: 'staging',
    };
    const context = getContext(query);
    render(
      <GlobalSelectionLink to={{pathname: path}}>Go somewhere!</GlobalSelectionLink>,
      {context}
    );

    await userEvent.click(screen.getByText('Go somewhere!'));

    expect(context.context.router.push).toHaveBeenCalledWith({pathname: path, query});
  });
});
