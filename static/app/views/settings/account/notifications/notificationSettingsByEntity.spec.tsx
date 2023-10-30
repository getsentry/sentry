import {Organization} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import NotificationSettingsByEntity from 'sentry/views/settings/account/notifications/notificationSettingsByEntity';

describe('NotificationSettingsByEntity', function () {
  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
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
});
