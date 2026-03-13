import {OrganizationFixture} from 'sentry-fixture/organization';
import {OrganizationIntegrationsFixture} from 'sentry-fixture/organizationIntegrations';
import {TeamFixture} from 'sentry-fixture/team';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {OrganizationStore} from 'sentry/stores/organizationStore';
import {TeamStore} from 'sentry/stores/teamStore';
import type {Organization} from 'sentry/types/organization';
import {CreateProject} from 'sentry/views/projectInstall/createProject';
import * as useValidateChannelModule from 'sentry/views/projectInstall/useValidateChannel';

jest.mock('sentry/actionCreators/indicator');

function renderFrameworkModalMockRequests({
  organization,
  teamSlug,
}: {
  organization: Organization;
  teamSlug: string;
}) {
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
    url: `/organizations/${organization.slug}/integrations/`,
    body: [
      OrganizationIntegrationsFixture({
        name: "Moo Deng's Workspace",
      }),
    ],
    match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
  });

  const projectCreationMockRequest = MockApiClient.addMockResponse({
    url: `/teams/${organization.slug}/${teamSlug}/projects/`,
    method: 'POST',
    body: {slug: 'testProj'},
  });

  const experimentalprojectCreationMockRequest = MockApiClient.addMockResponse({
    url: `/organizations/${organization.slug}/experimental/projects/`,
    method: 'POST',
    body: {slug: 'testProj', team: {slug: 'testTeam'}},
  });

  return {projectCreationMockRequest, experimentalprojectCreationMockRequest};
}

describe('CreateProject', () => {
  const teamNoAccess = TeamFixture({
    slug: 'test',
    id: '1',
    name: 'test',
    access: ['team:read'],
  });

  const teamWithAccess = TeamFixture({
    access: ['team:admin', 'team:write', 'team:read'],
  });

  const integration = OrganizationIntegrationsFixture({
    name: "Moo Deng's Workspace",
  });

  beforeEach(() => {
    TeamStore.reset();
    TeamStore.loadUserTeams([teamNoAccess]);

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/integrations/`,
      body: [integration],
      match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/integrations/${integration.id}/channels/`,
      body: {
        results: [],
      },
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should block if you have access to no teams without team-roles', () => {
    const organization = OrganizationFixture({
      id: '1',
      slug: 'org-slug',
      access: ['project:read'],
      features: [],
    });

    render(<CreateProject />, {organization});
  });

  it('can create a new project as member with team-roles', async () => {
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

  it('should only allow teams which the user is a team-admin', async () => {
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

  it('should fill in project name if its empty when platform is chosen', async () => {
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
    expect(screen.getByPlaceholderText('project-slug')).toHaveValue('apple-ios');

    await userEvent.click(screen.getByTestId('platform-ruby-rails'));
    expect(screen.getByPlaceholderText('project-slug')).toHaveValue('ruby-rails');

    // but not replace it when project slug is something else:
    await userEvent.clear(screen.getByPlaceholderText('project-slug'));
    await userEvent.type(screen.getByPlaceholderText('project-slug'), 'another');

    await userEvent.click(screen.getByTestId('platform-apple-ios'));
    expect(screen.getByPlaceholderText('project-slug')).toHaveValue('another');
  });

  it('should not overwrite a user-entered project name when the name happens to match the current platform key', async () => {
    // Regression test: previously, the check `projectName !== platform.key` would incorrectly
    // treat the name as auto-generated if it matched the current platform slug, causing a
    // platform switch to overwrite a name the user explicitly typed.
    const {organization} = initializeOrg({
      organization: {
        access: ['project:read'],
        features: ['team-roles'],
        allowMemberProjectCreation: true,
      },
    });

    render(<CreateProject />, {organization});

    // User explicitly types a name that happens to match a platform id
    await userEvent.type(screen.getByPlaceholderText('project-slug'), 'apple-ios');

    // User then selects a different platform
    await userEvent.click(screen.getByTestId('platform-ruby-rails'));

    // The name they typed should be preserved, not replaced with 'ruby-rails'
    expect(screen.getByPlaceholderText('project-slug')).toHaveValue('apple-ios');
  });

  it('should preserve user-entered project slug when filter bar auto-selects a platform', async () => {
    // Regression test: PlatformPicker's debounceSearch captured setPlatform from the
    // initial render. After the user typed a slug, handlePlatformChange was recreated with
    // the new projectName — but debounceSearch still held the stale version with
    // projectName='', so auto-selection via the filter bar would wipe the user's slug.
    const {organization} = initializeOrg({
      organization: {
        access: ['project:read'],
        features: ['team-roles'],
        allowMemberProjectCreation: true,
      },
    });

    jest.useFakeTimers();
    render(<CreateProject />, {organization});

    await userEvent.type(screen.getByPlaceholderText('project-slug'), 'my-custom-slug', {
      delay: null,
    });
    expect(screen.getByPlaceholderText('project-slug')).toHaveValue('my-custom-slug');

    // Type a platform name that exactly matches "Android" (triggers debounce auto-selection)
    await userEvent.type(screen.getByPlaceholderText('Filter Platforms'), 'android', {
      delay: null,
    });

    // Run all pending timers and flush React state updates
    act(() => {
      jest.runAllTimers();
    });

    jest.useRealTimers();

    // The user's slug must be preserved, not replaced by the auto-selected platform id
    expect(screen.getByPlaceholderText('project-slug')).toHaveValue('my-custom-slug');
  });

  it('should allow platform to fill the project name again after the user clears it', async () => {
    const {organization} = initializeOrg({
      organization: {
        access: ['project:read'],
        features: ['team-roles'],
        allowMemberProjectCreation: true,
      },
    });

    render(<CreateProject />, {organization});

    // User types a name
    await userEvent.type(screen.getByPlaceholderText('project-slug'), 'my-project');
    expect(screen.getByPlaceholderText('project-slug')).toHaveValue('my-project');

    // User clears the field (signals they want the platform to drive the name again)
    await userEvent.clear(screen.getByPlaceholderText('project-slug'));
    expect(screen.getByPlaceholderText('project-slug')).toHaveValue('');

    // Now selecting a platform should fill the name
    await userEvent.click(screen.getByTestId('platform-apple-ios'));
    expect(screen.getByPlaceholderText('project-slug')).toHaveValue('apple-ios');
  });

  it('should preserve user-entered project slug when returning via auto-fill after delayed route replace', async () => {
    // Regression test: when the user clicks "Back to Platform Selection", the browser
    // POP navigation fires first (without query params), mounting the component with
    // autoFill=false. Then router.replace adds ?referrer=getting-started&project=<id>,
    // transitioning autoFill to true. useRef only initializes once, so without the
    // useEffect sync, hasUserModifiedProjectName stays false and platform changes
    // overwrite the user's custom slug.
    const {organization} = initializeOrg({
      organization: {
        access: ['project:read'],
        features: ['team-roles'],
        allowMemberProjectCreation: true,
      },
    });

    TeamStore.loadUserTeams([teamWithAccess]);

    // Simulate a previously created project stored in localStorage
    window.localStorage.setItem(
      'created-project-context',
      JSON.stringify({
        id: '12345',
        name: 'my-custom-name',
        team: teamWithAccess.slug,
        platform: {
          key: 'javascript-angular',
          name: 'Angular',
          type: 'framework',
          language: 'javascript',
          category: 'popular',
        },
        wasNameManuallyModified: true,
      })
    );

    // Step 1: Mount WITHOUT query params (simulates the browser POP navigation)
    const {router} = render(<CreateProject />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/projects/new/',
        },
      },
    });

    // Step 2: Navigate WITH query params (simulates router.replace)
    router.navigate('/projects/new/?referrer=getting-started&project=12345');

    // The slug field should be auto-filled with the stored name
    await waitFor(() => {
      expect(screen.getByPlaceholderText('project-slug')).toHaveValue('my-custom-name');
    });

    // Step 3: Click a different platform
    await userEvent.click(screen.getByTestId('platform-apple-ios'));

    // The user's custom slug must be preserved, not replaced with 'apple-ios'
    expect(screen.getByPlaceholderText('project-slug')).toHaveValue('my-custom-name');

    // Clean up localStorage
    window.localStorage.removeItem('created-project-context');
  });

  it('should update project slug on platform change when slug was not manually modified', async () => {
    // When the user didn't manually type a slug (wasNameManuallyModified: false),
    // changing the platform should update the slug to the new platform's ID.
    const {organization} = initializeOrg({
      organization: {
        access: ['project:read'],
        features: ['team-roles'],
        allowMemberProjectCreation: true,
      },
    });

    TeamStore.loadUserTeams([teamWithAccess]);

    window.localStorage.setItem(
      'created-project-context',
      JSON.stringify({
        id: '12345',
        name: 'javascript-angular',
        team: teamWithAccess.slug,
        platform: {
          key: 'javascript-angular',
          name: 'Angular',
          type: 'framework',
          language: 'javascript',
          category: 'popular',
        },
        wasNameManuallyModified: false,
      })
    );

    const {router} = render(<CreateProject />, {
      organization,
      initialRouterConfig: {
        location: {
          pathname: '/projects/new/',
        },
      },
    });

    router.navigate('/projects/new/?referrer=getting-started&project=12345');

    await waitFor(() => {
      expect(screen.getByPlaceholderText('project-slug')).toHaveValue(
        'javascript-angular'
      );
    });

    // Click a different platform — slug should update since user didn't manually modify it
    await userEvent.click(screen.getByTestId('platform-apple-ios'));

    expect(screen.getByPlaceholderText('project-slug')).toHaveValue('apple-ios');

    window.localStorage.removeItem('created-project-context');
  });

  it('should display success message on proj creation', async () => {
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

  it('should display error message on proj creation failure', async () => {
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

  it('should display success message when using member endpoint', async () => {
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

  it('does not render framework selection modal if vanilla js is NOT selected', async () => {
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

  it('renders framework selection modal if vanilla js is selected', async () => {
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

  it('should rollback project when rule creation fails', async () => {
    const {organization} = initializeOrg({
      organization: {
        access: ['project:read'],
        features: ['team-roles'],
        allowMemberProjectCreation: true,
      },
    });

    const discordIntegration = OrganizationIntegrationsFixture({
      id: '338731',
      name: "Moo Deng's Server",
      provider: {
        key: 'discord',
        slug: 'discord',
        name: 'Discord',
        canAdd: true,
        canDisable: false,
        features: ['alert-rule', 'chat-unfurl'],
        aspects: {
          alerts: [],
        },
      },
    });

    TeamStore.loadUserTeams([teamWithAccess]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [TeamFixture({slug: teamWithAccess.slug})],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      body: organization,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/`,
      body: [discordIntegration],
      match: [MockApiClient.matchQuery({integrationType: 'messaging'})],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/${discordIntegration.id}/channels/`,
      body: {
        results: [
          {
            id: '1437461639900303454',
            name: 'general',
            display: '#general',
            type: 'text',
          },
        ],
      },
    });

    const projectCreationMockRequest = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/${teamWithAccess.slug}/projects/`,
      method: 'POST',
      body: {id: '1', slug: 'testProj', name: 'Test Project'},
    });

    const ruleCreationMockRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/testProj/rules/`,
      method: 'POST',
      statusCode: 400,
      body: {
        actions: ['Discord: Discord channel URL is missing or formatted incorrectly'],
      },
    });

    const projectDeletionMockRequest = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/testProj/`,
      method: 'DELETE',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [
        {
          id: '1',
          slug: 'testProj',
          name: 'Test Project',
        },
      ],
    });

    render(<CreateProject />, {organization});

    await userEvent.click(screen.getByTestId('platform-apple-ios'));
    await userEvent.click(
      screen.getByRole('checkbox', {
        name: /Notify via integration/,
      })
    );
    await selectEvent.select(screen.getByLabelText('channel'), /#general/);
    await userEvent.click(screen.getByRole('button', {name: 'Create Project'}));
    await waitFor(() => {
      expect(projectCreationMockRequest).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(ruleCreationMockRequest).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(projectDeletionMockRequest).toHaveBeenCalledTimes(1);
    });

    expect(addErrorMessage).toHaveBeenCalledWith('Failed to create project apple-ios');
  });

  describe('Issue Alerts Options', () => {
    const organization = OrganizationFixture();
    beforeEach(() => {
      TeamStore.loadUserTeams([teamWithAccess]);

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

    it('should enabled the submit button if and only if all the required information has been filled', async () => {
      const {projectCreationMockRequest} = renderFrameworkModalMockRequests({
        organization,
        teamSlug: teamWithAccess.slug,
      });

      render(<CreateProject />, {organization});

      // We need to query for the submit button every time we want to access it
      // as re-renders can create new DOM nodes
      const getSubmitButton = () => screen.getByRole('button', {name: 'Create Project'});

      expect(getSubmitButton()).toBeDisabled();

      // Fills the project slug
      await userEvent.type(screen.getByPlaceholderText('project-slug'), 'my-project');

      // Enforce users to select a platform
      await userEvent.hover(getSubmitButton());
      expect(await screen.findByText('Please select a platform')).toBeInTheDocument();

      await userEvent.click(getSubmitButton());
      expect(projectCreationMockRequest).not.toHaveBeenCalled();

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

      await userEvent.click(getSubmitButton());
      expect(projectCreationMockRequest).toHaveBeenCalled();
    });

    it('should disable submit button when channel validation fails and integration is selected', async () => {
      renderFrameworkModalMockRequests({
        organization,
        teamSlug: teamWithAccess.slug,
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/${integration.id}/channel-validate/`,
        body: {valid: false, detail: 'Channel not found'},
      });

      render(<CreateProject />, {organization});

      await userEvent.click(screen.getByTestId('platform-apple-ios'));
      expect(screen.getByRole('button', {name: 'Create Project'})).toBeEnabled();
      await userEvent.click(
        screen.getByRole('checkbox', {
          name: /Notify via integration/,
        })
      );
      await selectEvent.create(screen.getByLabelText('channel'), '#custom-channel', {
        waitForElement: false,
        createOptionText: '#custom-channel',
      });
      expect(await screen.findByText('Channel not found')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Create Project'})).toBeDisabled();
      await userEvent.hover(screen.getByRole('button', {name: 'Create Project'}));
      expect(await screen.findByText('Channel not found')).toBeInTheDocument();
      await userEvent.click(screen.getByLabelText('Clear choices'));
      await userEvent.hover(screen.getByRole('button', {name: 'Create Project'}));
      expect(
        await screen.findByText(/provide an integration channel/)
      ).toBeInTheDocument();
    });

    it('should NOT disable submit button when channel validation fails but integration is unchecked', async () => {
      renderFrameworkModalMockRequests({
        organization,
        teamSlug: teamWithAccess.slug,
      });

      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/integrations/${integration.id}/channel-validate/`,
        body: {valid: false, detail: 'Channel not found'},
      });

      render(<CreateProject />, {organization});

      await userEvent.click(screen.getByTestId('platform-apple-ios'));
      await userEvent.click(
        screen.getByRole('checkbox', {
          name: /Notify via integration/,
        })
      );
      await selectEvent.create(screen.getByLabelText('channel'), '#custom-channel', {
        waitForElement: false,
        createOptionText: '#custom-channel',
      });
      expect(await screen.findByText('Channel not found')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Create Project'})).toBeDisabled();
      await userEvent.click(
        screen.getByRole('checkbox', {
          name: /Notify via integration/,
        })
      );
      await waitFor(() => {
        expect(screen.getByRole('button', {name: 'Create Project'})).toBeEnabled();
      });
    });

    it('should show validating tooltip and disable button while validating channel', async () => {
      renderFrameworkModalMockRequests({
        organization,
        teamSlug: teamWithAccess.slug,
      });

      jest.spyOn(useValidateChannelModule, 'useValidateChannel').mockReturnValue({
        isFetching: true,
        clear: jest.fn(),
        error: undefined,
      });

      render(<CreateProject />, {organization});
      await userEvent.click(screen.getByTestId('platform-apple-ios'));
      await userEvent.click(
        screen.getByRole('checkbox', {
          name: /Notify via integration/,
        })
      );
      expect(screen.getByRole('button', {name: 'Create Project'})).toBeDisabled();
      await userEvent.hover(screen.getByRole('button', {name: 'Create Project'}));
      expect(
        await screen.findByText(/Validating integration channel/)
      ).toBeInTheDocument();
    });

    it('should create an issue alert rule by default', async () => {
      const {projectCreationMockRequest} = renderFrameworkModalMockRequests({
        organization,
        teamSlug: teamWithAccess.slug,
      });
      render(<CreateProject />, {organization});
      expect(screen.getByLabelText(/Alert me on high priority issues/i)).toBeChecked();
      await userEvent.click(screen.getByTestId('platform-javascript-react'));
      await userEvent.click(screen.getByRole('button', {name: 'Create Project'}));
      expect(projectCreationMockRequest).toHaveBeenCalledWith(
        `/teams/${organization.slug}/${teamWithAccess.slug}/projects/`,
        expect.objectContaining({
          data: {
            default_rules: true,
            name: 'javascript-react',
            origin: 'ui',
            platform: 'javascript-react',
          },
        })
      );
    });

    it('should NOT create alerts if the user opt out', async () => {
      const {projectCreationMockRequest} = renderFrameworkModalMockRequests({
        organization,
        teamSlug: teamWithAccess.slug,
      });
      render(<CreateProject />, {organization});
      await userEvent.click(screen.getByText(/create my own alerts later/i));
      expect(screen.getByLabelText(/create my own alerts later/i)).toBeChecked();
      await userEvent.click(screen.getByTestId('platform-javascript-react'));
      await userEvent.click(screen.getByRole('button', {name: 'Create Project'}));
      expect(projectCreationMockRequest).toHaveBeenCalledWith(
        `/teams/${organization.slug}/${teamWithAccess.slug}/projects/`,
        expect.objectContaining({
          data: {
            default_rules: false,
            name: 'javascript-react',
            origin: 'ui',
            platform: 'javascript-react',
          },
        })
      );
    });
  });
});
