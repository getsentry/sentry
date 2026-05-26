import {NotificationDefaultsFixture} from 'sentry-fixture/notificationDefaults';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import {ConfigStore} from 'sentry/stores/configStore';
import {OrganizationsStore} from 'sentry/stores/organizationsStore';
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
    match: [MockApiClient.matchQuery({provider: ['slack', 'slack_staging']})],
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/projects/',
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

    expect(await screen.findByText('Errors')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Receive notifications when your organization exceeds the following limits.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Transactions')).toBeInTheDocument();
    expect(screen.getByText('Spans')).toBeInTheDocument();
    expect(screen.getByText('Session Replays')).toBeInTheDocument();
    expect(screen.getByText('Attachments')).toBeInTheDocument();
    expect(screen.getByText('Seer Budget')).toBeInTheDocument();
    expect(screen.getByText('Spend Allocations')).toBeInTheDocument();
  });
  it('adds a project override and removes it', async () => {
    renderComponent({});

    await selectEvent.select(await screen.findByText('Project\u2026'), 'foo');
    await selectEvent.select(screen.getByText('Value\u2026'), 'On');

    const addSettingMock = MockApiClient.addMockResponse({
      url: '/users/me/notification-options/',
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
      url: '/users/me/notification-options/7/',
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
      url: '/users/me/notification-options/',
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
    await userEvent.tab();
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
      url: '/users/me/notification-providers/',
      method: 'PUT',
      body: [],
    });
    const multiSelect = await screen.findByRole('textbox', {name: 'Delivery Method'});
    await selectEvent.select(multiSelect, ['Email']);
    await userEvent.tab();
    expect(changeProvidersMock).toHaveBeenCalledTimes(1);
  });

  it('hides quota notifications on self-hosted', () => {
    ConfigStore.set('isSelfHosted', true);
    const {container} = renderComponent({notificationType: 'quota'});

    expect(container).toBeEmptyDOMElement();
  });
});
