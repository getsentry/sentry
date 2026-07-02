import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {ConfigStore} from 'sentry/stores/configStore';
import {WeeklyReportProjectExclusions} from 'sentry/views/settings/account/notifications/weeklyReportProjectExclusions';

describe('WeeklyReportProjectExclusions', () => {
  const organization = OrganizationFixture();
  const projectA = ProjectFixture({id: '1', slug: 'project-a', organization});
  const projectB = ProjectFixture({id: '2', slug: 'project-b', organization});

  const defaultNotificationProps = {
    notificationOptions: [],
    handleAddNotificationOption: jest.fn(),
    handleEditNotificationOption: jest.fn(),
    handleRemoveNotificationOption: jest.fn(),
  };

  beforeEach(() => {
    ConfigStore.set('customerDomain', {
      ...ConfigStore.get('customerDomain')!,
      subdomain: organization.slug,
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders all projects with switches ON when no exclusions', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [projectA, projectB],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/weekly-report-project-exclusions/`,
      body: [],
    });

    render(
      <WeeklyReportProjectExclusions
        organizations={[organization]}
        {...defaultNotificationProps}
      />
    );

    const switchA = await screen.findByRole('checkbox', {
      name: 'Toggle weekly report for project-a',
    });
    const switchB = screen.getByRole('checkbox', {
      name: 'Toggle weekly report for project-b',
    });
    expect(switchA).toBeChecked();
    expect(switchB).toBeChecked();
  });

  it('renders excluded projects with switches OFF', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [projectA, projectB],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/weekly-report-project-exclusions/`,
      body: [{id: '100', projectId: '1', projectSlug: 'project-a', dateAdded: ''}],
    });

    render(
      <WeeklyReportProjectExclusions
        organizations={[organization]}
        {...defaultNotificationProps}
      />
    );

    const switchA = await screen.findByRole('checkbox', {
      name: 'Toggle weekly report for project-a',
    });
    const switchB = screen.getByRole('checkbox', {
      name: 'Toggle weekly report for project-b',
    });
    expect(switchA).not.toBeChecked();
    expect(switchB).toBeChecked();
  });

  it('sends PUT with project added to exclusions when toggling OFF', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [projectA, projectB],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/weekly-report-project-exclusions/`,
      body: [],
    });
    const putMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/weekly-report-project-exclusions/`,
      method: 'PUT',
      statusCode: 204,
    });

    render(
      <WeeklyReportProjectExclusions
        organizations={[organization]}
        {...defaultNotificationProps}
      />
    );

    const switchA = await screen.findByRole('checkbox', {
      name: 'Toggle weekly report for project-a',
    });
    await userEvent.click(switchA);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {projectIds: [1]},
        })
      );
    });
  });

  it('sends PUT with project removed from exclusions when toggling ON', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [projectA, projectB],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/weekly-report-project-exclusions/`,
      body: [
        {id: '100', projectId: '1', projectSlug: 'project-a', dateAdded: ''},
        {id: '101', projectId: '2', projectSlug: 'project-b', dateAdded: ''},
      ],
    });
    const putMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/weekly-report-project-exclusions/`,
      method: 'PUT',
      statusCode: 204,
    });

    render(
      <WeeklyReportProjectExclusions
        organizations={[organization]}
        {...defaultNotificationProps}
      />
    );

    const switchA = await screen.findByRole('checkbox', {
      name: 'Toggle weekly report for project-a',
    });
    await userEvent.click(switchA);

    await waitFor(() => {
      expect(putMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {projectIds: [2]},
        })
      );
    });
  });

  it('shows empty state when no organization is selected', () => {
    const orgA = OrganizationFixture({id: '1', slug: 'org-a', name: 'Org A'});
    const orgB = OrganizationFixture({id: '2', slug: 'org-b', name: 'Org B'});
    ConfigStore.set('customerDomain', {
      ...ConfigStore.get('customerDomain')!,
      subdomain: '',
    });

    render(
      <WeeklyReportProjectExclusions
        organizations={[orgA, orgB]}
        {...defaultNotificationProps}
      />
    );

    expect(screen.getByText('Select an organization to continue')).toBeInTheDocument();
  });

  it('shows no projects found when org has no projects', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/weekly-report-project-exclusions/`,
      body: [],
    });

    render(
      <WeeklyReportProjectExclusions
        organizations={[organization]}
        {...defaultNotificationProps}
      />
    );

    expect(await screen.findByText('No projects found')).toBeInTheDocument();
  });

  it('shows warning when all projects are excluded', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [projectA, projectB],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/weekly-report-project-exclusions/`,
      body: [
        {id: '100', projectId: '1', projectSlug: 'project-a', dateAdded: ''},
        {id: '101', projectId: '2', projectSlug: 'project-b', dateAdded: ''},
      ],
    });

    render(
      <WeeklyReportProjectExclusions
        organizations={[organization]}
        {...defaultNotificationProps}
      />
    );

    expect(
      await screen.findByText(
        "You won't receive a weekly report for this organization if all projects are excluded."
      )
    ).toBeInTheDocument();
  });

  it('shows org-level dropdown that defaults to On', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [projectA],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/weekly-report-project-exclusions/`,
      body: [],
    });

    render(
      <WeeklyReportProjectExclusions
        organizations={[organization]}
        {...defaultNotificationProps}
      />
    );

    expect(await screen.findByText('On')).toBeInTheDocument();
  });

  it('hides project toggles when org report is off', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [projectA],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/weekly-report-project-exclusions/`,
      body: [],
    });

    render(
      <WeeklyReportProjectExclusions
        organizations={[organization]}
        notificationOptions={[
          {
            id: '1',
            type: 'reports',
            scopeType: 'organization',
            scopeIdentifier: organization.id,
            value: 'never',
          },
        ]}
        handleAddNotificationOption={jest.fn()}
        handleEditNotificationOption={jest.fn()}
        handleRemoveNotificationOption={jest.fn()}
      />
    );

    expect(await screen.findByText('Off')).toBeInTheDocument();

    expect(
      screen.queryByRole('checkbox', {
        name: 'Toggle weekly report for project-a',
      })
    ).not.toBeInTheDocument();
  });

  it('calls handleAddNotificationOption when switching org report to Off', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [projectA],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/weekly-report-project-exclusions/`,
      body: [],
    });

    const handleAdd = jest.fn();
    render(
      <WeeklyReportProjectExclusions
        organizations={[organization]}
        {...defaultNotificationProps}
        handleAddNotificationOption={handleAdd}
      />
    );

    await selectEvent.select(await screen.findByText('On'), 'Off');

    expect(handleAdd).toHaveBeenCalledWith({
      type: 'reports',
      scopeType: 'organization',
      scopeIdentifier: organization.id,
      value: 'never',
    });
  });

  it('calls handleRemoveNotificationOption when switching org report to On', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [projectA],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/weekly-report-project-exclusions/`,
      body: [],
    });

    const handleRemove = jest.fn();
    render(
      <WeeklyReportProjectExclusions
        organizations={[organization]}
        notificationOptions={[
          {
            id: '42',
            type: 'reports',
            scopeType: 'organization',
            scopeIdentifier: organization.id,
            value: 'never',
          },
        ]}
        handleAddNotificationOption={jest.fn()}
        handleEditNotificationOption={jest.fn()}
        handleRemoveNotificationOption={handleRemove}
      />
    );

    await selectEvent.select(await screen.findByText('Off'), 'On');

    expect(handleRemove).toHaveBeenCalledWith('42');
  });

  it('does not show project toggles when exclusions endpoint returns 404', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [projectA],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/weekly-report-project-exclusions/`,
      statusCode: 404,
      body: {},
    });

    render(
      <WeeklyReportProjectExclusions
        organizations={[organization]}
        {...defaultNotificationProps}
      />
    );

    expect(await screen.findByText('On')).toBeInTheDocument();

    expect(
      screen.queryByRole('checkbox', {
        name: 'Toggle weekly report for project-a',
      })
    ).not.toBeInTheDocument();
  });
});
