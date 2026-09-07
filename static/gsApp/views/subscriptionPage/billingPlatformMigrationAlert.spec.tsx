import {ConfigFixture} from 'sentry-fixture/config';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ConfigStore} from 'sentry/stores/configStore';

import {BillingPlatformMigrationAlert} from './billingPlatformMigrationAlert';

function setEmployeeUser(isEmployee: boolean) {
  ConfigStore.loadInitialData(
    ConfigFixture({
      user: UserFixture({
        emails: [
          {
            email: isEmployee ? 'dev@sentry.io' : 'dev@example.com',
            is_verified: true,
            id: '1',
          },
        ],
      }),
    })
  );
}

describe('BillingPlatformMigrationAlert', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    localStorage.clear();
    setEmployeeUser(true);
  });

  it('renders for employees when the org is migrated', () => {
    const subscription = SubscriptionFixture({
      organization,
      hasMigratedToBillingPlatform: true,
    });

    render(<BillingPlatformMigrationAlert subscription={subscription} />, {
      organization,
    });

    expect(
      screen.getByText('This organization is migrated to the billing platform.')
    ).toBeInTheDocument();
  });

  it('does not render when the org is not migrated', () => {
    const subscription = SubscriptionFixture({
      organization,
      hasMigratedToBillingPlatform: false,
    });

    render(<BillingPlatformMigrationAlert subscription={subscription} />, {
      organization,
    });

    expect(
      screen.queryByText('This organization is migrated to the billing platform.')
    ).not.toBeInTheDocument();
  });

  it('does not render for non-employees', () => {
    setEmployeeUser(false);
    const subscription = SubscriptionFixture({
      organization,
      hasMigratedToBillingPlatform: true,
    });

    render(<BillingPlatformMigrationAlert subscription={subscription} />, {
      organization,
    });

    expect(
      screen.queryByText('This organization is migrated to the billing platform.')
    ).not.toBeInTheDocument();
  });

  it('hides after the banner is dismissed', async () => {
    const subscription = SubscriptionFixture({
      organization,
      hasMigratedToBillingPlatform: true,
    });

    render(<BillingPlatformMigrationAlert subscription={subscription} />, {
      organization,
    });

    expect(
      screen.getByText('This organization is migrated to the billing platform.')
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Dismiss banner'}));

    expect(
      screen.queryByText('This organization is migrated to the billing platform.')
    ).not.toBeInTheDocument();
  });
});
