import {NotificationDefaultsFixture} from 'sentry-fixture/notificationDefaults';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';

import type {NotificationOptionsObject, NotificationProvidersObject} from './constants';
import {NotificationSettingsByType} from './notificationSettingsByType';
import type {Identity} from './types';

function renderMockRequests({
  notificationOptions = [],
  notificationProviders = [],
  identities = [],
  organizationIntegrations = [],
}: {
  identities?: Identity[];
  notificationOptions?: NotificationOptionsObject[];
  notificationProviders?: NotificationProvidersObject[];
  organizationIntegrations?: OrganizationIntegration[];
}) {
  MockApiClient.addMockResponse({
    url: '/users/me/notification-options/',
    method: 'GET',
    body: notificationOptions,
  });

  MockApiClient.addMockResponse({
    url: '/users/me/notification-providers/',
    method: 'GET',
    body: notificationProviders,
  });

  MockApiClient.addMockResponse({
    url: '/users/me/identities/',
    method: 'GET',
    body: identities,
  });

  MockApiClient.addMockResponse({
    url: '/users/me/organization-integrations/',
    method: 'GET',
    body: organizationIntegrations,
  });

  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/projects/`,
    method: 'GET',
    body: [
      {
        id: '4',
        slug: 'foo',
        name: 'foo',
      },
    ],
  });
}

function renderComponent({
  notificationOptions = [],
  notificationProviders = [],
  identities = [],
  organizationIntegrations = [],
  organizations = [],
  notificationType = 'alerts',
}: {
  identities?: Identity[];
  notificationOptions?: NotificationOptionsObject[];
  notificationProviders?: NotificationProvidersObject[];
  notificationType?: string;
  organizationIntegrations?: OrganizationIntegration[];
  organizations?: Organization[];
}) {
  const org = OrganizationFixture();
  renderMockRequests({
    notificationOptions,
    notificationProviders,
    identities,
    organizationIntegrations,
  });
  organizations = organizations.length ? organizations : [org];

  OrganizationsStore.load(organizations);

  return render(<NotificationSettingsByType notificationType={notificationType} />);
}

describe('NotificationSettingsByType', () => {
  afterEach(() => {
    MockApiClient.clearMockResponses();
    OrganizationsStore.init();
    jest.clearAllMocks();
  });
  beforeEach(() => {
    OrganizationsStore.init();
    MockApiClient.addMockResponse({
      url: '/notification-defaults/',
      method: 'GET',
      body: NotificationDefaultsFixture(),
    });
  });

  it('should render when default is disabled', async () => {
    renderComponent({
      notificationOptions: [
        {
          id: '1',
          scopeIdentifier: '2',
          scopeType: 'user',
          type: 'alerts',
          value: 'never',
        },
      ],
    });

    // There is only one field and it is the default and it is set to "off".
    await screen.findByRole('textbox', {name: 'Issue Alerts'});
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('should default to the subdomain org', async () => {
    const organization = OrganizationFixture();
    const otherOrganization = OrganizationFixture({
      id: '2',
      slug: 'other-org',
      name: 'other org',
    });
    ConfigStore.set('customerDomain', {
      ...ConfigStore.get('customerDomain')!,
      subdomain: otherOrganization.slug,
    });
    // renderMockRequests({
    //   alerts: {user: {me: {email: 'always', slack: 'always'}}},
    // });
    const projectsMock = MockApiClient.addMockResponse({
      url: `/organizations/${otherOrganization.slug}/projects/`,
      method: 'GET',
      body: [],
    });
    renderComponent({organizations: [organization, otherOrganization]});
    expect(await screen.findByText(otherOrganization.name)).toBeInTheDocument();
    expect(projectsMock).toHaveBeenCalledTimes(1);
  });

  it('renders all the quota subcategories', async () => {
    renderComponent({notificationType: 'quota'});

    // check for all the quota subcategories
    expect(
      await screen.findByText(
        'Receive notifications when your organization exceeds the following limits.'
      )
    ).toBeInTheDocument();
    expect(
      await screen.findByText('Receive notifications about your error quotas.')
    ).toBeInTheDocument();
    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Session Replays')).toBeInTheDocument();
    expect(screen.getByText('Attachments')).toBeInTheDocument();
    expect(screen.getByText('Spend Allocations')).toBeInTheDocument();
    expect(screen.queryByText('Spans')).not.toBeInTheDocument();
  });
  it('adds a project override and removes it', async () => {
    renderComponent({});

    await selectEvent.select(await screen.findByText('Project\u2026'), 'foo');
    await selectEvent.select(screen.getByText('Value\u2026'), 'On');

    const addSettingMock = MockApiClient.addMockResponse({
      url: `/users/me/notification-options/`,
      method: 'PUT',
      body: {
        id: '7',
        scopeIdentifier: '4',
        scopeType: 'project',
        type: 'alerts',
        value: 'always',
      },
    });

    // click the add button
    await userEvent.click(screen.getByRole('button', {name: 'Add override'}));
    expect(addSettingMock).toHaveBeenCalledTimes(1);

    // check it hits delete
    const deleteSettingMock = MockApiClient.addMockResponse({
      url: `/users/me/notification-options/7/`,
      method: 'DELETE',
      body: {},
    });
    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));
    expect(deleteSettingMock).toHaveBeenCalledTimes(1);
  });
  it('edits a project override', async () => {
    renderComponent({
      notificationOptions: [
        {
          id: '7',
          scopeIdentifier: '4',
          scopeType: 'project',
          type: 'alerts',
          value: 'always',
        },
      ],
    });
    const editSettingMock = MockApiClient.addMockResponse({
      url: `/users/me/notification-options/`,
      method: 'PUT',
      body: {
        id: '7',
        scopeIdentifier: '4',
        scopeType: 'project',
        type: 'alerts',
        value: 'never',
      },
    });

    expect(await screen.findByText('foo')).toBeInTheDocument();
    await selectEvent.select(screen.getAllByText('On')[1]!, 'Off');

    expect(editSettingMock).toHaveBeenCalledTimes(1);
    expect(editSettingMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          id: '7',
          scopeIdentifier: '4',
          scopeType: 'project',
          type: 'alerts',
          value: 'never',
        },
      })
    );
  });
  it('renders and sets the provider options', async () => {
    renderComponent({
      notificationProviders: [
        {
          id: '1',
          type: 'alerts',
          scopeType: 'user',
          scopeIdentifier: '1',
          provider: 'email',
          value: 'never',
        },
      ],
    });
    const changeProvidersMock = MockApiClient.addMockResponse({
      url: `/users/me/notification-providers/`,
      method: 'PUT',
      body: [],
    });
    const multiSelect = await screen.findByRole('textbox', {name: 'Delivery Method'});
    await selectEvent.select(multiSelect, ['Email']);
    expect(changeProvidersMock).toHaveBeenCalledTimes(1);
  });

  it('renders spend notifications page instead of quota notifications with flag', async () => {
    const organizationWithFlag = OrganizationFixture();
    organizationWithFlag.features.push('spend-visibility-notifications');
    const organizationNoFlag = OrganizationFixture();
    renderComponent({
      notificationType: 'quota',
      organizations: [organizationWithFlag, organizationNoFlag],
    });

    expect(await screen.findAllByText('Spend Notifications')).toHaveLength(2);
    expect(screen.queryByText('Quota Notifications')).not.toBeInTheDocument();
    expect(
      screen.getByText('Control the notifications you receive for organization spend.')
    ).toBeInTheDocument();
  });

  it('toggle user spend notifications', async () => {
    const organizationWithFlag = OrganizationFixture();
    organizationWithFlag.features.push('spend-visibility-notifications');
    const organizationNoFlag = OrganizationFixture();
    renderComponent({
      notificationType: 'quota',
      organizations: [organizationWithFlag, organizationNoFlag],
    });

    expect(await screen.findAllByText('Spend Notifications')).toHaveLength(2);

    const editSettingMock = MockApiClient.addMockResponse({
      url: `/users/me/notification-options/`,
      method: 'PUT',
      body: {
        id: '7',
        scopeIdentifier: '1',
        scopeType: 'user',
        type: 'quota',
        value: 'never',
      },
    });

    // toggle spend notifications off
    await selectEvent.select(screen.getAllByText('On')[0]!, 'Off');

    expect(editSettingMock).toHaveBeenCalledTimes(1);
    expect(editSettingMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          scopeIdentifier: '1',
          scopeType: 'user',
          type: 'quota',
          value: 'never',
        },
      })
    );
  });

  it('spend notifications on org with am3 with spend visibility notifications', async () => {
    const organization = OrganizationFixture({
      features: [
        'spend-visibility-notifications',
        'am3-tier',
        'continuous-profiling-billing',
        'seer-billing',
        'logs-billing',
        'seer-user-billing',
        'seer-user-billing-launch',
      ],
    });
    renderComponent({
      notificationType: 'quota',
      organizations: [organization],
    });

    expect(await screen.findAllByText('Spend Notifications')).toHaveLength(2);

    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Spans')).toBeInTheDocument();
    expect(screen.getByText('Session Replays')).toBeInTheDocument();
    expect(screen.getByText('Attachments')).toBeInTheDocument();
    expect(screen.getByText('Spend Allocations')).toBeInTheDocument();
    expect(
      screen.getByText('Continuous Profile Hours', {exact: true})
    ).toBeInTheDocument();
    expect(screen.getByText('UI Profile Hours', {exact: true})).toBeInTheDocument();
    expect(screen.getByText('Seer Budget')).toBeInTheDocument();
    expect(screen.getByText('Logs')).toBeInTheDocument();
    expect(screen.getByText('Active Contributors')).toBeInTheDocument();
    expect(screen.queryByText('Transactions')).not.toBeInTheDocument();

    const editSettingMock = MockApiClient.addMockResponse({
      url: `/users/me/notification-options/`,
      method: 'PUT',
      body: {
        id: '7',
        scopeIdentifier: '1',
        scopeType: 'user',
        type: 'quotaSpans',
        value: 'never',
      },
    });

    // toggle spans quota notifications off
    await selectEvent.select(screen.getAllByText('On')[4]!, 'Off');

    expect(editSettingMock).toHaveBeenCalledTimes(1);
    expect(editSettingMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          scopeIdentifier: '1',
          scopeType: 'user',
          type: 'quotaSpans',
          value: 'never',
        },
      })
    );
  });

  it('spend notifications on org with am3 and org without am3', async () => {
    const organization = OrganizationFixture({
      features: [
        'spend-visibility-notifications',
        'am3-tier',
        'continuous-profiling-billing',
        'seer-billing',
      ],
    });
    const otherOrganization = OrganizationFixture();
    renderComponent({
      notificationType: 'quota',
      organizations: [organization, otherOrganization],
    });

    expect(await screen.findAllByText('Spend Notifications')).toHaveLength(2);

    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Spans')).toBeInTheDocument();
    expect(screen.getByText('Session Replays')).toBeInTheDocument();
    expect(screen.getByText('Attachments')).toBeInTheDocument();
    expect(screen.getByText('Spend Allocations')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(
      screen.getByText('Continuous Profile Hours', {exact: true})
    ).toBeInTheDocument();
    expect(screen.getByText('UI Profile Hours', {exact: true})).toBeInTheDocument();
    expect(screen.getByText('Seer Budget')).toBeInTheDocument();
  });

  it('spend notifications on org with am1 org only', async () => {
    const organization = OrganizationFixture({
      features: [
        'spend-visibility-notifications',
        'am1-tier',
        'continuous-profiling-billing',
        'seer-billing',
      ],
    });
    const otherOrganization = OrganizationFixture();
    renderComponent({
      notificationType: 'quota',
      organizations: [organization, otherOrganization],
    });

    expect(await screen.findAllByText('Spend Notifications')).toHaveLength(2);

    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Session Replays')).toBeInTheDocument();
    expect(screen.getByText('Attachments')).toBeInTheDocument();
    expect(screen.getByText('Spend Allocations')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(
      screen.queryByText('Continuous Profile Hours', {exact: true})
    ).not.toBeInTheDocument();
    expect(screen.queryByText('UI Profile Hours', {exact: true})).not.toBeInTheDocument();
    expect(screen.queryByText('Spans')).not.toBeInTheDocument();
    expect(screen.getByText('Seer Budget')).toBeInTheDocument();
  });

  it('spend notifications on org with am3 without spend visibility notifications', async () => {
    const organization = OrganizationFixture({
      features: ['am3-tier', 'continuous-profiling-billing', 'seer-billing'],
    });
    renderComponent({
      notificationType: 'quota',
      organizations: [organization],
    });

    expect(await screen.findAllByText('Quota Notifications')).toHaveLength(1);
    expect(screen.queryByText('Spend Notifications')).not.toBeInTheDocument();

    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Spans')).toBeInTheDocument();
    expect(screen.getByText('Session Replays')).toBeInTheDocument();
    expect(screen.getByText('Attachments')).toBeInTheDocument();
    expect(screen.getByText('Spend Allocations')).toBeInTheDocument();
    expect(
      screen.getByText('Continuous Profile Hours', {exact: true})
    ).toBeInTheDocument();
    expect(screen.getByText('UI Profile Hours', {exact: true})).toBeInTheDocument();
    expect(screen.queryByText('Transactions')).not.toBeInTheDocument();
    expect(screen.getByText('Seer Budget')).toBeInTheDocument();

    const editSettingMock = MockApiClient.addMockResponse({
      url: `/users/me/notification-options/`,
      method: 'PUT',
      body: {
        id: '7',
        scopeIdentifier: '1',
        scopeType: 'user',
        type: 'quotaSpans',
        value: 'never',
      },
    });

    // toggle spans quota notifications off
    await selectEvent.select(screen.getAllByText('On')[3]!, 'Off');

    expect(editSettingMock).toHaveBeenCalledTimes(1);
    expect(editSettingMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          scopeIdentifier: '1',
          scopeType: 'user',
          type: 'quotaSpans',
          value: 'never',
        },
      })
    );
  });

  it('should not show categories without related features', async () => {
    const organization = OrganizationFixture({
      features: [
        'spend-visibility-notifications',
        'am3-tier',
        // No continuous-profiling-billing feature
        // No seer-billing feature
        // No logs-billing feature
      ],
    });
    renderComponent({
      notificationType: 'quota',
      organizations: [organization],
    });

    expect(await screen.findAllByText('Spend Notifications')).toHaveLength(2);

    // These should be present
    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Spans')).toBeInTheDocument();
    expect(screen.getByText('Session Replays')).toBeInTheDocument();
    expect(screen.getByText('Attachments')).toBeInTheDocument();
    expect(screen.getByText('Spend Allocations')).toBeInTheDocument();

    // These should NOT be present
    expect(
      screen.queryByText('Continuous Profile Hours', {exact: true})
    ).not.toBeInTheDocument();
    expect(screen.queryByText('UI Profile Hours', {exact: true})).not.toBeInTheDocument();
    expect(screen.queryByText('Transactions')).not.toBeInTheDocument();
    expect(screen.queryByText('Seer Budget')).not.toBeInTheDocument();
    expect(screen.queryByText('Logs')).not.toBeInTheDocument();
    expect(screen.queryByText('Active Contributors')).not.toBeInTheDocument();
  });
});
