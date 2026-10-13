import {DetailedProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ProjectLogs from 'sentry/views/settings/project/projectLogs';

describe('ProjectLogs', () => {
  const {organization} = initializeOrg({
    organization: {features: ['explore-automatic-json-expansion-ui']},
  });
  const project = DetailedProjectFixture({
    options: {
      'sentry:relay_automatic_json_expansion': false,
    },
  });
  const initialRouterConfig = {
    location: {
      pathname: `/settings/projects/${project.slug}/logs/`,
    },
    route: '/settings/projects/:projectId/logs/',
  };
  const getProjectEndpoint = `/projects/${organization.slug}/${project.slug}/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: getProjectEndpoint,
      method: 'GET',
      body: project,
    });
  });

  it('renders the json expansion field', async () => {
    render(<ProjectLogs />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(await screen.findByText('Expand JSON Attributes')).toBeInTheDocument();
  });

  it('hides the page without the feature', () => {
    const {organization: organizationWithoutFeature} = initializeOrg();

    render(<ProjectLogs />, {
      organization: organizationWithoutFeature,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(screen.queryByText('Expand JSON Attributes')).not.toBeInTheDocument();
  });

  it('can toggle json expansion', async () => {
    render(<ProjectLogs />, {
      organization,
      outletContext: {project},
      initialRouterConfig,
    });

    const updatedProject = {
      ...project,
      options: {...project.options, 'sentry:relay_automatic_json_expansion': true},
    };
    const mock = MockApiClient.addMockResponse({
      url: getProjectEndpoint,
      method: 'PUT',
      body: updatedProject,
    });

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Expand JSON Attributes',
    });
    MockApiClient.addMockResponse({
      url: getProjectEndpoint,
      method: 'GET',
      body: updatedProject,
    });
    await userEvent.click(checkbox);

    await waitFor(() =>
      expect(mock).toHaveBeenCalledWith(
        getProjectEndpoint,
        expect.objectContaining({
          method: 'PUT',
          data: {
            options: {'sentry:relay_automatic_json_expansion': true},
          },
        })
      )
    );
    await waitFor(() => expect(checkbox).toBeEnabled());
    expect(checkbox).toBeChecked();
  });

  it('disables the toggle without write access', async () => {
    const {organization: readOnlyOrganization} = initializeOrg({
      organization: {
        access: ['org:read', 'project:read'],
        features: ['explore-automatic-json-expansion-ui'],
      },
    });

    render(<ProjectLogs />, {
      organization: readOnlyOrganization,
      outletContext: {project},
      initialRouterConfig,
    });

    expect(
      await screen.findByRole('checkbox', {name: 'Expand JSON Attributes'})
    ).toBeDisabled();
  });
});
