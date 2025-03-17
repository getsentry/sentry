import {NotificationDefaultsFixture} from 'sentry-fixture/notificationDefaults';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ConfigStore from 'sentry/stores/configStore';
import type {OrganizationIntegration} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';

import type {NotificationOptionsObject, NotificationProvidersObject} from './constants';
import NotificationSettingsByType from './notificationSettingsByType';
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

  return render(
    <NotificationSettingsByType
      notificationType={notificationType}
      organizations={organizations}
    />
  );
}

describe('NotificationSettingsByType', function () {
  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/notification-defaults/',
      method: 'GET',
      body: NotificationDefaultsFixture(),
    });
  });

  it('should render when default is disabled', function () {
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
    expect(screen.getByRole('textbox', {name: 'Issue Alerts'})).toBeInTheDocument();
    expect(screen.getByText('Off')).toBeInTheDocument();
  });

  it('should default to the subdomain org', async function () {
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

  it('renders all the quota subcategories', async function () {
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
  it('adds a project override and removes it', async function () {
    renderComponent({});

    await selectEvent.select(screen.getByText('Project\u2026'), 'foo');
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
  it('edits a project override', async function () {
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
  it('renders and sets the provider options', async function () {
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
    const multiSelect = screen.getByRole('textbox', {name: 'Delivery Method'});
    await selectEvent.select(multiSelect, ['Email']);
    expect(changeProvidersMock).toHaveBeenCalledTimes(1);
  });

  it('renders spend notifications page instead of quota notifications with flag', async function () {
    const organizationWithFlag = OrganizationFixture();
    organizationWithFlag.features.push('spend-visibility-notifications');
    const organizationNoFlag = OrganizationFixture();
    renderComponent({
      notificationType: 'quota',
      organizations: [organizationWithFlag, organizationNoFlag],
    });

    expect(await screen.getAllByText('Spend Notifications').length).toBe(2);
    expect(screen.queryByText('Quota Notifications')).not.toBeInTheDocument();
    expect(
      screen.getByText('Control the notifications you receive for organization spend.')
    ).toBeInTheDocument();
  });

  it('toggle user spend notifications', async function () {
    const organizationWithFlag = OrganizationFixture();
    organizationWithFlag.features.push('spend-visibility-notifications');
    const organizationNoFlag = OrganizationFixture();
    renderComponent({
      notificationType: 'quota',
      organizations: [organizationWithFlag, organizationNoFlag],
    });

    expect(await screen.getAllByText('Spend Notifications').length).toBe(2);

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

  it('spend notifications on org with am3 with spend visibility notifications', async function () {
    const organization = OrganizationFixture();
    organization.features.push('spend-visibility-notifications');
    organization.features.push('am3-tier');
    renderComponent({
      notificationType: 'quota',
      organizations: [organization],
    });

    expect(await screen.getAllByText('Spend Notifications').length).toBe(2);

    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Spans')).toBeInTheDocument();
    expect(screen.getByText('Session Replays')).toBeInTheDocument();
    expect(screen.getByText('Attachments')).toBeInTheDocument();
    expect(screen.getByText('Spend Allocations')).toBeInTheDocument();
    expect(screen.queryByText('Continuous Profiling')).not.toBeInTheDocument(); // TODO(Continuous Profiling GA): should be in document
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

  it('spend notifications on org with am3 and org without am3', async function () {
    const organization = OrganizationFixture();
    organization.features.push('spend-visibility-notifications');
    organization.features.push('am3-tier');
    const otherOrganization = OrganizationFixture();
    renderComponent({
      notificationType: 'quota',
      organizations: [organization, otherOrganization],
    });

    expect(await screen.getAllByText('Spend Notifications').length).toBe(2);

    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Spans')).toBeInTheDocument();
    expect(screen.getByText('Session Replays')).toBeInTheDocument();
    expect(screen.getByText('Attachments')).toBeInTheDocument();
    expect(screen.getByText('Spend Allocations')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.queryByText('Continuous Profiling')).not.toBeInTheDocument(); // TODO(Continuous Profiling GA): should be in document
  });

  it('spend notifications on org with am1 org only', async function () {
    const organization = OrganizationFixture();
    organization.features.push('spend-visibility-notifications');
    organization.features.push('am1-tier');
    const otherOrganization = OrganizationFixture();
    renderComponent({
      notificationType: 'quota',
      organizations: [organization, otherOrganization],
    });

    expect(await screen.getAllByText('Spend Notifications').length).toBe(2);

    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Session Replays')).toBeInTheDocument();
    expect(screen.getByText('Attachments')).toBeInTheDocument();
    expect(screen.getByText('Spend Allocations')).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.queryByText('Continuous Profiling')).not.toBeInTheDocument();
    expect(screen.queryByText('Spans')).not.toBeInTheDocument();
  });

  it('spend notifications on org with am3 without spend visibility notifications', async function () {
    const organization = OrganizationFixture();
    organization.features.push('am3-tier');
    renderComponent({
      notificationType: 'quota',
      organizations: [organization],
    });

    expect(await screen.getAllByText('Quota Notifications').length).toBe(1);
    expect(screen.queryByText('Spend Notifications')).not.toBeInTheDocument();

    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Spans')).toBeInTheDocument();
    expect(screen.getByText('Session Replays')).toBeInTheDocument();
    expect(screen.getByText('Attachments')).toBeInTheDocument();
    expect(screen.getByText('Spend Allocations')).toBeInTheDocument();
    expect(screen.queryByText('Continuous Profiling')).not.toBeInTheDocument(); // TODO(Continuous Profiling GA): should be in document
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
});
