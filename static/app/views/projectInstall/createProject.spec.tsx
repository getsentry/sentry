import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';
import {MOCK_RESP_VERBOSE} from 'sentry-fixture/ruleConditions';
import {TeamFixture} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import OrganizationStore from 'sentry/stores/organizationStore';
import TeamStore from 'sentry/stores/teamStore';
import type {Organization} from 'sentry/types/organization';
import {CreateProject} from 'sentry/views/projectInstall/createProject';

jest.mock('sentry/actionCreators/indicator');

function renderFrameworkModalMockRequests({
  organization,
  teamSlug,
}: {
  organization: Organization;
  teamSlug: string;
}) {
  MockApiClient.addMockResponse({
    url: `/projects/${organization.slug}/rule-conditions/`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/teams/`,
    body: [TeamFixture({slug: teamSlug})],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/`,
    body: organization,
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/projects/`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/integrations/?integrationType=messaging`,
    body: [
      OrganizationIntegrationsFixture({
        name: "Moo Deng's Workspace",
      }),
    ],
  });

  const projectCreationMockRequest = MockApiClient.addMockResponse({
    url: `/teams/${organization.slug}/${teamSlug}/projects/`,
    method: 'POST',
    body: {slug: 'testProj'},
  });

  const experimentalprojectCreationMockRequest = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/experimental/projects/`,
    method: 'POST',
    body: {slug: 'testProj', team_slug: 'testTeam'},
  });

  return {projectCreationMockRequest, experimentalprojectCreationMockRequest};
}

describe('CreateProject', function () {
  const teamNoAccess = TeamFixture({
    slug: 'test',
    id: '1',
    name: 'test',
    access: ['team:read'],
  });

  const teamWithAccess = TeamFixture({
    access: ['team:admin', 'team:write', 'team:read'],
  });

  beforeEach(() => {
    TeamStore.reset();
    TeamStore.loadUserTeams([teamNoAccess]);

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/rule-conditions/`,
      body: {},
      // Not required for these tests
      statusCode: 500,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/integrations/?integrationType=messaging`,
      body: [
        OrganizationIntegrationsFixture({
          name: "Moo Deng's Workspace",
        }),
      ],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should block if you have access to no teams without team-roles', function () {
    const organization = OrganizationFixture({
      id: '1',
      slug: 'org-slug',
      access: ['project:read'],
      features: [],
    });

    render(<CreateProject />, {organization});
  });

  it('can create a new project as member with team-roles', async function () {
    const {organization} = initializeOrg({
      organization: {
        access: ['project:read'],
        features: ['team-roles'],
        allowMemberProjectCreation: true,
      },
    });

    renderFrameworkModalMockRequests({organization, teamSlug: 'team-two'});
    TeamStore.loadUserTeams([TeamFixture({id: '2', slug: 'team-two', access: []})]);

    render(<CreateProject />, {
      organization,
    });

    renderGlobalModal();
    await userEvent.click(screen.getByTestId('platform-apple-ios'));
    const createTeamButton = screen.queryByRole('button', {name: 'Create a team'});
    expect(createTeamButton).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create Project'})).toBeEnabled();
  });

  it('should only allow teams which the user is a team-admin', async function () {
    const {organization} = initializeOrg({
      organization: {
        features: ['team-roles'],
      },
    });
    renderFrameworkModalMockRequests({organization, teamSlug: 'team-two'});

    OrganizationStore.onUpdate(organization);
    TeamStore.loadUserTeams([
      TeamFixture({id: '1', slug: 'team-one', access: []}),
      TeamFixture({id: '2', slug: 'team-two', access: ['team:admin']}),
      TeamFixture({id: '3', slug: 'team-three', access: ['team:admin']}),
    ]);
    render(<CreateProject />, {
      organization,
    });

    await userEvent.type(screen.getByLabelText('Select a Team'), 'team');
    expect(screen.queryByText('#team-one')).not.toBeInTheDocument();
    expect(screen.getByText('#team-two')).toBeInTheDocument();
    expect(screen.getByText('#team-three')).toBeInTheDocument();
  });

  it('should fill in project name if its empty when platform is chosen', async function () {
    const {organization} = initializeOrg({
      organization: {
        access: ['project:read'],
        features: ['team-roles'],
        allowMemberProjectCreation: true,
      },
    });

    render(<CreateProject />, {
      organization,
    });

    await userEvent.click(screen.getByTestId('platform-apple-ios'));
    expect(screen.getByPlaceholderText('project-name')).toHaveValue('apple-ios');

    await userEvent.click(screen.getByTestId('platform-ruby-rails'));
    expect(screen.getByPlaceholderText('project-name')).toHaveValue('ruby-rails');

    // but not replace it when project name is something else:
    await userEvent.clear(screen.getByPlaceholderText('project-name'));
    await userEvent.type(screen.getByPlaceholderText('project-name'), 'another');

    await userEvent.click(screen.getByTestId('platform-apple-ios'));
    expect(screen.getByPlaceholderText('project-name')).toHaveValue('another');
  });

  it('should display success message on proj creation', async function () {
    const {organization} = initializeOrg({
      organization: {
        access: ['project:read'],
        features: ['team-roles'],
        allowMemberProjectCreation: true,
      },
    });

    const frameWorkModalMockRequests = renderFrameworkModalMockRequests({
      organization,
      teamSlug: teamWithAccess.slug,
    });
    TeamStore.loadUserTeams([teamWithAccess]);

    render(<CreateProject />, {
      organization,
    });

    renderGlobalModal();
    await userEvent.click(screen.getByTestId('platform-apple-ios'));
    await userEvent.click(screen.getByRole('button', {name: 'Create Project'}));

    expect(frameWorkModalMockRequests.projectCreationMockRequest).toHaveBeenCalledTimes(
      1
    );
    expect(addSuccessMessage).toHaveBeenCalledWith('Created project testProj');
  });

  it('should display error message on proj creation failure', async function () {
    const {organization} = initializeOrg({
      organization: {
        access: ['project:read'],
        features: ['team-roles'],
        allowMemberProjectCreation: true,
      },
    });

    const frameWorkModalMockRequests = renderFrameworkModalMockRequests({
      organization,
      teamSlug: teamWithAccess.slug,
    });
    frameWorkModalMockRequests.projectCreationMockRequest = MockApiClient.addMockResponse(
      {
        url: `/teams/${organization.slug}/${teamWithAccess.slug}/projects/`,
        method: 'POST',
        body: {slug: 'testProj'},
        statusCode: 404,
      }
    );
    TeamStore.loadUserTeams([teamWithAccess]);

    render(<CreateProject />, {
      organization,
    });

    renderGlobalModal();
    await userEvent.click(screen.getByTestId('platform-apple-ios'));
    await userEvent.click(screen.getByRole('button', {name: 'Create Project'}));

    expect(frameWorkModalMockRequests.projectCreationMockRequest).toHaveBeenCalledTimes(
      1
    );
    expect(addErrorMessage).toHaveBeenCalledWith('Failed to create project apple-ios');
  });

  it('should display success message when using member endpoint', async function () {
    const {organization} = initializeOrg({
      organization: {
        access: ['project:read'],
        features: ['team-roles'],
        allowMemberProjectCreation: true,
      },
    });

    const frameWorkModalMockRequests = renderFrameworkModalMockRequests({
      organization,
      teamSlug: teamNoAccess.slug,
    });
    render(<CreateProject />, {
      organization,
    });

    renderGlobalModal();
    await userEvent.click(screen.getByTestId('platform-apple-ios'));
    await userEvent.click(screen.getByRole('button', {name: 'Create Project'}));

    expect(
      frameWorkModalMockRequests.experimentalprojectCreationMockRequest
    ).toHaveBeenCalledTimes(1);
    expect(addSuccessMessage).toHaveBeenCalledWith(
      'Created testProj under new team #testTeam'
    );
  });

  it('does not render framework selection modal if vanilla js is NOT selected', async function () {
    const {organization} = initializeOrg({
      organization: {
        features: ['team-roles'],
        access: ['project:read', 'project:write'],
        allowMemberProjectCreation: true,
      },
    });

    const frameWorkModalMockRequests = renderFrameworkModalMockRequests({
      organization,
      teamSlug: teamWithAccess.slug,
    });

    TeamStore.loadUserTeams([teamWithAccess]);
    OrganizationStore.onUpdate(organization, {replace: true});

    render(<CreateProject />, {
      organization,
    });

    // Select the React platform
    await userEvent.click(screen.getByTestId('platform-javascript-react'));

    await userEvent.type(screen.getByLabelText('Select a Team'), teamWithAccess.slug);
    await userEvent.click(screen.getByText(`#${teamWithAccess.slug}`));

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Create Project'})).toBeEnabled();
    });

    renderGlobalModal();

    // Click on 'configure SDK' button
    await userEvent.click(screen.getByRole('button', {name: 'Create Project'}));

    // Modal shall not be open
    expect(screen.queryByText('Do you use a framework?')).not.toBeInTheDocument();

    expect(frameWorkModalMockRequests.projectCreationMockRequest).toHaveBeenCalled();
  });

  it('renders framework selection modal if vanilla js is selected', async function () {
    const {organization} = initializeOrg();

    const frameWorkModalMockRequests = renderFrameworkModalMockRequests({
      organization,
      teamSlug: teamWithAccess.slug,
    });

    TeamStore.loadUserTeams([teamWithAccess]);
    OrganizationStore.onUpdate(organization, {replace: true});

    render(<CreateProject />, {
      organization,
    });

    // Select the JavaScript platform
    await userEvent.click(screen.getByTestId('platform-javascript'));

    await userEvent.type(screen.getByLabelText('Select a Team'), teamWithAccess.slug);
    await userEvent.click(screen.getByText(`#${teamWithAccess.slug}`));

    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Create Project'})).toBeEnabled();
    });

    renderGlobalModal();

    // Click on 'configure SDK' button
    await userEvent.click(screen.getByRole('button', {name: 'Create Project'}));

    // Modal is open
    await screen.findByText('Do you use a framework?');

    // Close modal
    await userEvent.click(screen.getByRole('button', {name: 'Close Modal'}));

    expect(frameWorkModalMockRequests.projectCreationMockRequest).not.toHaveBeenCalled();
  });

  describe('Issue Alerts Options', function () {
    const organization = OrganizationFixture();
    beforeEach(() => {
      TeamStore.loadUserTeams([teamWithAccess]);

      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/rule-conditions/`,
        body: MOCK_RESP_VERBOSE,
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/?integrationType=messaging`,
        body: [
          OrganizationIntegrationsFixture({
            name: "Moo Deng's Workspace",
          }),
        ],
      });
    });

    afterEach(() => {
      MockApiClient.clearMockResponses();
    });

    it('should enabled the submit button if and only if all the required information has been filled', async function () {
      render(<CreateProject />, {organization});

      // We need to query for the submit button every time we want to access it
      // as re-renders can create new DOM nodes
      const getSubmitButton = () => screen.getByRole('button', {name: 'Create Project'});

      expect(getSubmitButton()).toBeDisabled();

      // Selecting the platform pre-fills the project name
      await userEvent.click(screen.getByTestId('platform-apple-ios'));
      expect(getSubmitButton()).toBeEnabled();

      await userEvent.click(screen.getByText(/When there are more than/));
      expect(getSubmitButton()).toBeEnabled();

      await userEvent.clear(screen.getByTestId('range-input'));
      expect(getSubmitButton()).toBeDisabled();

      await userEvent.type(screen.getByTestId('range-input'), '2712');
      expect(getSubmitButton()).toBeEnabled();

      await userEvent.clear(screen.getByTestId('range-input'));
      expect(getSubmitButton()).toBeDisabled();

      await userEvent.click(
        screen.getByRole('checkbox', {
          name: 'Notify via integration (Slack, Discord, MS Teams, etc.)',
        })
      );
      expect(getSubmitButton()).toBeDisabled();

      await userEvent.click(screen.getByText("I'll create my own alerts later"));
      expect(getSubmitButton()).toBeEnabled();
    });
  });
});
