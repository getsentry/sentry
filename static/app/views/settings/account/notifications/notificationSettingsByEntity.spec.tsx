import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import NotificationSettingsByEntity from 'sentry/views/settings/account/notifications/notificationSettingsByEntity';

describe('NotificationSettingsByEntity', function () {
  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
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
    const projectsMock = MockApiClient.addMockResponse({
      url: `/organizations/${otherOrganization.slug}/projects/`,
      method: 'GET',
      body: [],
    });

    render(
      <NotificationSettingsByEntity
        organizations={[organization, otherOrganization]}
        notificationType="alerts"
        notificationOptions={[]}
        handleRemoveNotificationOption={jest.fn()}
        handleAddNotificationOption={jest.fn()}
        handleEditNotificationOption={jest.fn()}
        entityType={'project' as const}
      />
    );
    expect(await screen.findByText(otherOrganization.name)).toBeInTheDocument();
    expect(projectsMock).toHaveBeenCalledTimes(1);
  });

  it('should load from the organization region', async function () {
    const organization = OrganizationFixture();
    const deOrg = OrganizationFixture({
      id: '2',
      slug: 'de-org',
      name: 'de org',
      links: {
        organizationUrl: 'https://de-org.sentry.io',
        regionUrl: 'https://de.sentry.io',
      },
    });
    ConfigStore.set('customerDomain', {
      ...ConfigStore.get('customerDomain')!,
      subdomain: deOrg.slug,
    });
    const projectsMock = MockApiClient.addMockResponse({
      url: `/organizations/${deOrg.slug}/projects/`,
      method: 'GET',
      body: [ProjectFixture({organization: deOrg})],
      match: [
        function (_url: string, options: Record<string, any>) {
          return options.host === 'https://de.sentry.io';
        },
      ],
    });

    render(
      <NotificationSettingsByEntity
        organizations={[organization, deOrg]}
        notificationType="alerts"
        notificationOptions={[]}
        handleRemoveNotificationOption={jest.fn()}
        handleAddNotificationOption={jest.fn()}
        handleEditNotificationOption={jest.fn()}
        entityType={'project' as const}
      />
    );
    expect(await screen.findByText(deOrg.name)).toBeInTheDocument();
    expect(projectsMock).toHaveBeenCalledTimes(1);
  });
});
