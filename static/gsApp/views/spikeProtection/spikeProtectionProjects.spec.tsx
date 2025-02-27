import {AvailableNotificationActionsFixture} from 'sentry-fixture/availableNotificationActions';

import {ProjectFixture} from 'getsentry-test/fixtures/project';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  cleanup,
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import type {Project} from 'sentry/types/project';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {SPIKE_PROTECTION_OPTION_DISABLED} from 'getsentry/views/spikeProtection/constants';
import SpikeProtectionProjects from 'getsentry/views/spikeProtection/spikeProtectionProjects';

describe('project renders and toggles', () => {
  const projects = [
    ProjectFixture({
      id: '1',
      slug: 'project1',
      // If the project option is True, the feature is disabled
      options: {[SPIKE_PROTECTION_OPTION_DISABLED]: true},
      access: ['project:read'],
    }),
    ProjectFixture({
      id: '2',
      slug: 'project2',
      // If the project option is False, the feature is Enabled
      options: {[SPIKE_PROTECTION_OPTION_DISABLED]: false},
      access: ['project:read', 'project:write', 'project:admin'],
    }),
  ];
  let organization: any,
    router: any,
    mockGet: any,
    mockPost: any,
    mockDelete: any,
    mockDeleteAll: any,
    mockPostAll: any,
    mockGetProjectNotificationActions: any;

  beforeEach(() => {
    MockApiClient.clearMockResponses();

    const newData = initializeOrg({
      projects,
      organization: {
        features: ['global-views'],
        openMembership: true,
        access: ['org:write'],
      },
    });
    organization = newData.organization;
    router = newData.router;
    SubscriptionStore.set(organization.slug, SubscriptionFixture({organization}));

    mockGet = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      method: 'GET',
      body: projects,
      statusCode: 200,
    });
    mockPost = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spike-protections/`,
      method: 'POST',
      body: [],
      statusCode: 200,
    });
    mockPostAll = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spike-protections/?projectSlug=$all`,
      method: 'POST',
      body: [],
      statusCode: 200,
    });
    mockDelete = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spike-protections/`,
      method: 'DELETE',
      body: [],
      statusCode: 200,
    });
    mockDeleteAll = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spike-protections/?projectSlug=$all`,
      method: 'DELETE',
      body: [],
      statusCode: 200,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/notifications/available-actions/`,
      method: 'GET',
      body: AvailableNotificationActionsFixture(),
      statusCode: 200,
    });
    mockGetProjectNotificationActions = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/notifications/actions/`,
      match: [
        MockApiClient.matchQuery({
          triggerType: 'spike-protection',
          project: projects[0]!.id,
        }),
      ],
      method: 'GET',
      body: [
        {
          id: 2,
          organizationId: parseInt(organization.id, 10),
          integrationId: null,
          sentryAppId: null,
          projects: [parseInt(projects[0]!.id, 10)],
          serviceType: 'sentry_notification',
          triggerType: 'spike-protection',
          targetType: 'specific',
          targetIdentifier: 'default',
          targetDisplay: 'default',
        },
      ],
      statusCode: 200,
    });
  });
  afterEach(() => {
    cleanup();
  });

  async function validateComponents(project: Project, isEnabled: boolean) {
    const toggle = await screen.findByTestId(`${project.slug}-spike-protection-toggle`);

    if (isEnabled) {
      expect(toggle).toBeChecked();
    } else {
      expect(toggle).not.toBeChecked();
    }

    return {toggle};
  }

  it('renders projects table even with no projects', async () => {
    const mockGetNoProjects = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      method: 'GET',
      body: [],
      statusCode: 200,
    });

    render(<SpikeProtectionProjects />, {router});
    expect(mockGetNoProjects).toHaveBeenCalled();
    expect(await screen.findByText('There are no items to display')).toBeInTheDocument();
  });

  it('renders projects accessible to user under closed membership', async () => {
    organization.openMembership = false;

    render(<SpikeProtectionProjects />, {organization});

    expect(await screen.findByText('project1')).toBeInTheDocument();

    const requestOptions = mockGet.mock.calls[0][1];
    expect(requestOptions.query).toEqual(
      expect.objectContaining({query: ' is_member:1'})
    );
  });

  it('renders all projects for superuser', async () => {
    // even under closed membership
    organization.access = ['org:superuser'];

    render(<SpikeProtectionProjects />, {organization});

    expect(await screen.findByText('project1')).toBeInTheDocument();

    const requestOptions = mockGet.mock.calls[0][1];
    expect(requestOptions.query).toEqual(
      expect.not.objectContaining({query: ' is_member:1'})
    );
  });

  it('renders all projects for owner', async () => {
    // even under closed membership
    organization.access = ['org:admin'];

    render(<SpikeProtectionProjects />, {organization});

    expect(await screen.findByText('project1')).toBeInTheDocument();

    const requestOptions = mockGet.mock.calls[0][1];
    expect(requestOptions.query).toEqual(
      expect.not.objectContaining({query: ' is_member:1'})
    );
  });

  it('renders toggles', async () => {
    const project = projects[0]!;
    render(<SpikeProtectionProjects />, {router});

    expect(mockGet).toHaveBeenCalled();
    const {toggle} = await validateComponents(project, false);

    await userEvent.click(toggle);

    await validateComponents(project, true);
    expect(mockPost).toHaveBeenCalled();
  });

  it('renders enabled/disabled toggles from team-roles', async () => {
    const projectDisabled = projects[0]!;
    const projectEnabled = projects[1]!;
    organization.access = [];
    render(<SpikeProtectionProjects />, {organization});

    const toggleDisabled = await screen.findByTestId(
      `${projectDisabled.slug}-spike-protection-toggle`
    );
    expect(toggleDisabled).toBeDisabled();

    const toggleEnabled = await screen.findByTestId(
      `${projectEnabled.slug}-spike-protection-toggle`
    );
    expect(toggleEnabled).toBeEnabled();
  });

  it('renders default value for toggles', async () => {
    const newProjects = [
      ProjectFixture({
        id: '1',
        slug: 'project1',
        options: {[SPIKE_PROTECTION_OPTION_DISABLED]: true},
      }),
      ProjectFixture({
        id: '2',
        slug: 'project2',
        options: {[SPIKE_PROTECTION_OPTION_DISABLED]: false},
      }),
    ];
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      method: 'GET',
      body: [...newProjects],
      statusCode: 200,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/notifications/available-actions/`,
      method: 'GET',
      body: AvailableNotificationActionsFixture(),
      statusCode: 200,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/org-slug/notifications/actions/`,
      match: [MockApiClient.matchQuery({triggerType: 'spike-protection'})],
      method: 'GET',
      body: [],
      statusCode: 200,
    });

    render(<SpikeProtectionProjects />, {router});
    await validateComponents(newProjects[0]!, false);
    await validateComponents(newProjects[1]!, true);
  });

  it('responds to successful toggles', async () => {
    const project = projects[0]!;

    render(<SpikeProtectionProjects />, {router});
    expect(mockGet).toHaveBeenCalled();

    const {toggle} = await validateComponents(project, false);

    await userEvent.click(toggle);
    expect(mockPost).toHaveBeenCalled();

    await validateComponents(project, true);

    // toggle off spike protection
    await userEvent.click(toggle);

    expect(mockDelete).toHaveBeenCalled();
    await validateComponents(project, false);
  });

  it('responds to unsuccessful toggle', async () => {
    const mockPostFailed = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/spike-protections/`,
      method: 'POST',
      statusCode: 403,
    });
    const project = projects[0]!;

    render(<SpikeProtectionProjects />, {router});
    expect(mockGet).toHaveBeenCalled();

    const {toggle} = await validateComponents(project, false);

    await userEvent.click(toggle);

    expect(mockPostFailed).toHaveBeenCalled();
    await validateComponents(project, false);
  });

  it('searches successfully', async () => {
    const projectSlug = projects[0]!.slug;
    render(<SpikeProtectionProjects />, {organization});

    const projectSearch = await screen.findByPlaceholderText('Search projects');
    await userEvent.click(projectSearch);
    await userEvent.paste(projectSlug);

    expect(projectSearch).toHaveValue(projectSlug);
    expect(mockGet).toHaveBeenCalledTimes(2);

    const requestOptions = mockGet.mock.calls[1][1];
    expect(requestOptions.query).toEqual(expect.objectContaining({query: projectSlug}));
  });

  it('response to successful toggle for all projects', async () => {
    renderGlobalModal();
    render(<SpikeProtectionProjects />, {router});
    await validateComponents(projects[0]!, false);
    await validateComponents(projects[1]!, true);

    const enableAll = await screen.findByTestId(`sp-enable-all`);

    await userEvent.click(enableAll);
    await userEvent.click(await screen.findByTestId('confirm-button'));

    expect(mockPostAll).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: {projects: []}})
    );

    for (const project of projects) {
      await validateComponents(project, true);
    }
  });

  it('response to successful disable toggle for all projects', async () => {
    renderGlobalModal();
    render(<SpikeProtectionProjects />, {router});
    await validateComponents(projects[0]!, false);
    await validateComponents(projects[1]!, true);

    const disableAll = await screen.findByTestId(`sp-disable-all`);

    await userEvent.click(disableAll);
    await userEvent.click(await screen.findByTestId('confirm-button'));

    expect(mockDeleteAll).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: {projects: []}})
    );

    for (const project of projects) {
      await validateComponents(project, false);
    }
  });

  it('fetches notification actions upon accordion opening', async () => {
    const project = projects[0]!;

    mockGet = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      method: 'GET',
      body: [project],
      statusCode: 200,
    });

    render(<SpikeProtectionProjects />, {organization});

    await userEvent.click(
      await screen.findByTestId(`${project.slug}-spike-protection-toggle`)
    );
    await userEvent.click(screen.getByTestId('accordion-title'));

    expect(mockGetProjectNotificationActions).toHaveBeenCalled();
    expect(await screen.findByTestId('sentry_notification-action')).toBeInTheDocument();
  });

  it('closes the accordion upon disable', async () => {
    const project = projects[0]!;
    render(<SpikeProtectionProjects />, {organization});

    await userEvent.click(
      await screen.findByTestId(`${project.slug}-spike-protection-toggle`)
    );
    await userEvent.click(screen.getByTestId(`${project.slug}-spike-protection-toggle`));

    expect(
      screen.getByTestId(`${project.slug}-accordion-row-disabled`)
    ).toBeInTheDocument();
  });
});
