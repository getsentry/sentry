import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OrganizationsStore} from 'sentry/stores/organizationsStore';
import {OrganizationStore} from 'sentry/stores/organizationStore';

import AccountNotificationFineTuningController from './accountNotificationFineTuningController';

const inboxRouterConfig = {
  initialRouterConfig: {
    route: '/settings/account/notifications/:fineTuneType/',
    location: {pathname: '/settings/account/notifications/inbox/'},
  },
};

describe('AccountNotificationFineTuningController', () => {
  beforeEach(() => {
    OrganizationsStore.load([OrganizationFixture()]);
    OrganizationStore.reset();
  });

  it('waits for the organization to load before gating the inbox page', () => {
    render(<AccountNotificationFineTuningController />, {
      ...inboxRouterConfig,
      organization: null,
    });

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
    expect(screen.queryByText('Page Not Found')).not.toBeInTheDocument();
  });

  it('shows not found when the loaded organization lacks the inbox', () => {
    const organization = OrganizationFixture();
    OrganizationStore.onUpdate(organization);

    render(<AccountNotificationFineTuningController />, {
      ...inboxRouterConfig,
      organization,
    });

    expect(screen.getByText('Page Not Found')).toBeInTheDocument();
  });
});
