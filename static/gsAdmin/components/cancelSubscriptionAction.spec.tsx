import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openAdminConfirmModal} from 'admin/components/adminConfirmationModal';
import CancelSubscriptionAction from 'admin/components/cancelSubscriptionAction';

describe('Cancel Subscription', () => {
  it('cancels immediately', async () => {
    const onConfirm = jest.fn();
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({organization});

    openAdminConfirmModal({
      onConfirm,
      renderModalSpecificContent: deps => (
        <CancelSubscriptionAction subscription={subscription} {...deps} />
      ),
    });

    renderGlobalModal();

    await userEvent.click(screen.getByRole('radio', {name: 'Immediately'}));
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(onConfirm).toHaveBeenCalledWith({
      applyBalance: true,
      cancelAtPeriodEnd: false,
    });
  });

  it('shows contract period if set', () => {
    const organization = OrganizationFixture();
    const subscription = SubscriptionFixture({
      organization,
      plan: 'mm2_a_100k_ac',
      isFree: false,
      canCancel: true,
      canSelfServe: true,
      billingPeriodEnd: '2022-09-08',
      contractPeriodEnd: '2023-09-08',
    });
    openAdminConfirmModal({
      renderModalSpecificContent: deps => (
        <CancelSubscriptionAction subscription={subscription} {...deps} />
      ),
    });
    renderGlobalModal();
    expect(screen.getByLabelText('At period end (Sep 8, 2023)')).toBeInTheDocument();
  });
});
