import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectPlugins from 'sentry/views/settings/projectPlugins/projectPlugins';

describe('ProjectPlugins', function () {
  it('renders', async function () {
    const {organization, route, router, project} = initializeOrg();

    const {container} = render(
      <ProjectPlugins
        params={{
          orgId: organization.slug,
        }}
        project={project}
        onChange={jest.fn()}
        loading={false}
        error={undefined}
        plugins={TestStubs.Plugins()}
        router={router}
        routes={router.routes}
        route={route}
        location={router.location}
        routeParams={router.params}
      />
    );

    await waitFor(() =>
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
    );

    expect(container).toSnapshot();
  });

  it('has error state when plugins=[]', async function () {
    const {organization, route, router, project} = initializeOrg();

    render(
      <ProjectPlugins
        params={{
          orgId: organization.slug,
        }}
        project={project}
        onChange={jest.fn()}
        loading={false}
        error={new Error('An error')}
        plugins={[]}
        router={router}
        routes={router.routes}
        route={route}
        location={router.location}
        routeParams={router.params}
      />
    );

    expect(await screen.findByText('Oops! Something went wrong')).toBeInTheDocument();
  });
});
