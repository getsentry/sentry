import {Plugins} from 'sentry-fixture/plugins';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectPlugins from 'sentry/views/settings/projectPlugins/projectPlugins';

describe('ProjectPlugins', function () {
  it('renders', async function () {
    const {organization, routerProps, project} = initializeOrg();

    render(
      <ProjectPlugins
        {...routerProps}
        organization={organization}
        params={{
          orgId: organization.slug,
        }}
        project={project}
        onChange={jest.fn()}
        loading={false}
        error={undefined}
        plugins={Plugins()}
      />
    );

    await waitFor(() =>
      expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
    );
  });

  it('has error state when plugins=[]', async function () {
    const {organization, routerProps, project} = initializeOrg();

    render(
      <ProjectPlugins
        {...routerProps}
        organization={organization}
        params={{
          orgId: organization.slug,
        }}
        project={project}
        onChange={jest.fn()}
        loading={false}
        error={new Error('An error')}
        plugins={[]}
      />
    );

    expect(await screen.findByText('Oops! Something went wrong')).toBeInTheDocument();
  });
});
