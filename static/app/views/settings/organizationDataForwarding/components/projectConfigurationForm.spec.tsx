import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ProjectConfigurationForm} from 'sentry/views/settings/organizationDataForwarding/components/projectConfigurationForm';
import {
  DataForwarderProviderSlug,
  type DataForwarder,
} from 'sentry/views/settings/organizationDataForwarding/util/types';

const ORG_SLUG = 'test-org';
const DF_ID = 'df-123';
const ENDPOINT = `/organizations/${ORG_SLUG}/forwarding/${DF_ID}/`;

function makeDataForwarder(partial: Partial<DataForwarder> = {}): DataForwarder {
  return {
    id: DF_ID,
    provider: DataForwarderProviderSlug.SQS,
    isEnabled: true,
    enrollNewProjects: false,
    enrolledProjects: [],
    config: {},
    organizationId: '1',
    projectConfigs: [],
    ...partial,
  };
}

describe('ProjectConfigurationForm', () => {
  const organization = OrganizationFixture({slug: ORG_SLUG});
  const projects = [
    ProjectFixture({id: 'p1', slug: 'project-one'}),
    ProjectFixture({id: 'p2', slug: 'project-two'}),
  ];

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders panel header, field labels, and save button', () => {
    render(
      <ProjectConfigurationForm dataForwarder={makeDataForwarder()} projects={projects} />,
      {organization}
    );

    expect(screen.getByText('Project Configuration')).toBeInTheDocument();
    expect(screen.getByText('Auto-enroll new projects')).toBeInTheDocument();
    expect(screen.getByText('Forwarding projects')).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Save Project Configuration'})
    ).toBeInTheDocument();
  });

  it('initializes switch as unchecked when enrollNewProjects is false', () => {
    render(
      <ProjectConfigurationForm
        dataForwarder={makeDataForwarder({enrollNewProjects: false})}
        projects={projects}
      />,
      {organization}
    );

    expect(
      screen.getByRole('checkbox', {name: 'Auto-enroll new projects'})
    ).not.toBeChecked();
  });

  it('initializes switch as checked when enrollNewProjects is true', () => {
    render(
      <ProjectConfigurationForm
        dataForwarder={makeDataForwarder({enrollNewProjects: true})}
        projects={projects}
      />,
      {organization}
    );

    expect(
      screen.getByRole('checkbox', {name: 'Auto-enroll new projects'})
    ).toBeChecked();
  });

  it('toggles enroll_new_projects and submits to API', async () => {
    const putMock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
      body: makeDataForwarder({enrollNewProjects: true}),
    });

    render(
      <ProjectConfigurationForm
        dataForwarder={makeDataForwarder({enrollNewProjects: false})}
        projects={projects}
      />,
      {organization}
    );

    const toggle = screen.getByRole('checkbox', {name: 'Auto-enroll new projects'});
    await userEvent.click(toggle);
    expect(toggle).toBeChecked();

    await userEvent.click(screen.getByRole('button', {name: 'Save Project Configuration'}));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          method: 'PUT',
          data: expect.objectContaining({
            enroll_new_projects: true,
            project_ids: [],
          }),
        })
      );
    });
  });

  it('selects a project and submits to API', async () => {
    const putMock = MockApiClient.addMockResponse({
      url: ENDPOINT,
      method: 'PUT',
      body: makeDataForwarder(),
    });

    render(
      <ProjectConfigurationForm dataForwarder={makeDataForwarder()} projects={projects} />,
      {organization}
    );

    // Open the multi-select and pick the first project
    await userEvent.click(screen.getByRole('textbox', {name: 'Forwarding projects'}));
    await userEvent.click(
      screen.getByRole('menuitemcheckbox', {name: 'project-one'})
    );
    await userEvent.keyboard('{Escape}');

    await userEvent.click(screen.getByRole('button', {name: 'Save Project Configuration'}));

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        ENDPOINT,
        expect.objectContaining({
          method: 'PUT',
          data: expect.objectContaining({
            enroll_new_projects: false,
            project_ids: ['p1'],
          }),
        })
      );
    });
  });

  it('pre-selects enrolled projects', () => {
    render(
      <ProjectConfigurationForm
        dataForwarder={makeDataForwarder({enrolledProjects: [projects[0]!]})}
        projects={projects}
      />,
      {organization}
    );

    // The enrolled project's slug should be visible as a selected chip
    expect(screen.getByText('project-one')).toBeInTheDocument();
  });

  it('disables switch and save button when disabled prop is true', () => {
    render(
      <ProjectConfigurationForm
        dataForwarder={makeDataForwarder()}
        projects={projects}
        disabled
      />,
      {organization}
    );

    expect(
      screen.getByRole('checkbox', {name: 'Auto-enroll new projects'})
    ).toBeDisabled();
    expect(
      screen.getByRole('button', {name: 'Save Project Configuration'})
    ).toBeDisabled();
  });
});
