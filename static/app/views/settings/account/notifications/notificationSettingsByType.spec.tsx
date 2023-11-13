import selectEvent from 'react-select-event';
import {NotificationDefaults} from 'sentry-fixture/notificationDefaults';
import {Organization} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import {Organization as TOrganization} from 'sentry/types';
import {OrganizationIntegration} from 'sentry/types/integrations';

import {NotificationOptionsObject, NotificationProvidersObject} from './constants';
import NotificationSettingsByType from './notificationSettingsByType';
import {Identity} from './types';

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
  organizations?: TOrganization[];
}) {
  const org = Organization();
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
      body: NotificationDefaults(),
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
    const organization = Organization();
    const otherOrganization = Organization({
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

  it('renders all the quota subcatories', async function () {
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
    expect(screen.getByText('Replays')).toBeInTheDocument();
    expect(screen.getByText('Attachments')).toBeInTheDocument();
    expect(screen.getByText('Spend Allocations')).toBeInTheDocument();
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
    await selectEvent.select(screen.getAllByText('On')[1], 'Off');

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
});
