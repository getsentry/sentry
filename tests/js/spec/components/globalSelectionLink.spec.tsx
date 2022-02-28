import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import GlobalSelectionLink from 'sentry/components/globalSelectionLink';

const path = 'http://some.url/';

describe('GlobalSelectionLink', function () {
  const getContext = (query: {environment: string; project: string[]}) =>
    TestStubs.routerContext([
      {
        router: TestStubs.router({
          location: {query},
        }),
      },
    ]);

  it('has global selection values in query', function () {
    const query = {
      project: ['foo', 'bar'],
      environment: 'staging',
    };
    const context = getContext(query);

    const {container} = mountWithTheme(
      <GlobalSelectionLink to={path}>Go somewhere!</GlobalSelectionLink>,
      {context}
    );
    expect(container).toSnapshot();
    expect(screen.getByText('Go somewhere!')).toHaveAttribute(
      'href',
      'http://some.url/?environment=staging&project=foo&project=bar'
    );

    userEvent.click(screen.getByText('Go somewhere!'));
    expect(context.context.router.push).toHaveBeenCalledWith({pathname: path, query});
  });

  it('does not have global selection values in query', function () {
    const {container} = mountWithTheme(
      <GlobalSelectionLink to={path}>Go somewhere!</GlobalSelectionLink>
    );

    expect(screen.getByText('Go somewhere!')).toHaveAttribute('href', path);

    expect(container).toSnapshot();
  });

  it('combines query parameters with custom query', function () {
    const query = {
      project: ['foo', 'bar'],
      environment: 'staging',
    };
    const context = getContext(query);
    const customQuery = {query: 'something'};
    mountWithTheme(
      <GlobalSelectionLink to={{pathname: path, query: customQuery}}>
        Go somewhere!
      </GlobalSelectionLink>,
      {context}
    );

    userEvent.click(screen.getByText('Go somewhere!'));
    expect(context.context.router.push).toHaveBeenCalledWith({
      pathname: path,
      query: {project: ['foo', 'bar'], environment: 'staging', query: 'something'},
    });
  });

  it('combines query parameters with no query', function () {
    const query = {
      project: ['foo', 'bar'],
      environment: 'staging',
    };
    const context = getContext(query);
    mountWithTheme(
      <GlobalSelectionLink to={{pathname: path}}>Go somewhere!</GlobalSelectionLink>,
      {context}
    );

    userEvent.click(screen.getByText('Go somewhere!'));

    expect(context.context.router.push).toHaveBeenCalledWith({pathname: path, query});
  });
});
