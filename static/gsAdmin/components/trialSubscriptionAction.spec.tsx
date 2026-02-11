import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {openAdminConfirmModal} from 'admin/components/adminConfirmationModal';
import TrialSubscriptionAction from 'admin/components/trialSubscriptionAction';
import {PlanTier} from 'getsentry/types';

describe('TrialSubscriptionAction', () => {
  const organization = OrganizationFixture();
  const onConfirm = jest.fn();

  const now = moment();
  const formattedNow = now.format('MMMM Do YYYY');
  const trialEnd = now.add(14, 'days');
  const formattedTrialEnd = trialEnd.format('MMMM Do YYYY');

  async function confirmTrialDays(days: any) {
    const daysInput = screen.getByRole('spinbutton', {name: 'Number of Days'});

    await userEvent.clear(daysInput);
    await userEvent.type(daysInput, days);
    await userEvent.click(screen.getByTestId('confirm-button'));
  }

  it('can pass trialDays onConfirm', async () => {
    openAdminConfirmModal({
      onConfirm,
      renderModalSpecificContent: deps => (
        <TrialSubscriptionAction
          subscription={SubscriptionFixture({organization})}
          {...deps}
        />
      ),
    });

    renderGlobalModal();
    await confirmTrialDays('30');

    expect(onConfirm).toHaveBeenCalledWith({trialDays: 30});
  });

  it('can pass trialDays and enterprise plan onConfirm', async () => {
    jest.mock('@sentry/scraps/alert');

    openAdminConfirmModal({
      onConfirm,
      renderModalSpecificContent: deps => (
        <TrialSubscriptionAction
          subscription={SubscriptionFixture({
            organization,
            plan: 'mm2_f',
            isFree: true,
          })}
          startEnterpriseTrial
          {...deps}
        />
      ),
    });

    renderGlobalModal();

    expect(
      screen.getByText('Spike protection will need to be manually disabled.')
    ).toBeInTheDocument();
    await confirmTrialDays('45');

    expect(onConfirm).toHaveBeenCalledWith({
      trialDays: 45,
      startEnterpriseTrial: true,
      trialTier: PlanTier.AM3,
    });
  });

  it('can pass trialDays and extend enterprise plan onConfirm', async () => {
    jest.mock('@sentry/scraps/alert');

    openAdminConfirmModal({
      onConfirm,
      renderModalSpecificContent: deps => (
        <TrialSubscriptionAction
          subscription={SubscriptionFixture({
            organization,
            plan: 'mm2_a_500k',
            isFree: false,
            isEnterpriseTrial: true,
          })}
          {...deps}
        />
      ),
    });

    renderGlobalModal();
    await confirmTrialDays('21');

    expect(onConfirm).toHaveBeenCalledWith({trialDays: 21});
  });

  it('can pass trialDays and trialPlanOverride onConfirm', async () => {
    jest.mock('@sentry/scraps/alert');

    openAdminConfirmModal({
      onConfirm,
      renderModalSpecificContent: deps => (
        <TrialSubscriptionAction
          subscription={SubscriptionFixture({
            organization,
            plan: 'am3_f',
            isFree: true,
          })}
          startEnterpriseTrial
          {...deps}
        />
      ),
    });

    renderGlobalModal();

    await userEvent.click(screen.getByTestId('trial-plan-tier-choices'));
    const trialTierInputs = within(screen.getByRole('dialog')).getAllByRole('textbox');
    await userEvent.click(trialTierInputs[0]!);
    await userEvent.click(screen.getByText('am3 with Dynamic Sampling'));
    await confirmTrialDays('14');

    expect(onConfirm).toHaveBeenCalledWith({
      trialDays: 14,
      startEnterpriseTrial: true,
      trialTier: PlanTier.AM3,
      trialPlanOverride: 'am3_t_ent_ds',
    });
  });

  it('displays correct trial end date when starting trial', async () => {
    jest.mock('@sentry/scraps/alert');

    openAdminConfirmModal({
      onConfirm,
      renderModalSpecificContent: deps => (
        <TrialSubscriptionAction
          subscription={SubscriptionFixture({
            organization,
            plan: 'mm2_f',
            isFree: true,
          })}
          {...deps}
        />
      ),
    });

    renderGlobalModal();

    const daysInput = screen.getByRole('spinbutton', {name: 'Number of Days'});
    await userEvent.clear(daysInput);
    await userEvent.type(daysInput, '0');

    expect(daysInput).toHaveAccessibleDescription(
      `Their trial will end on ${formattedNow}`
    );
  });

  it('displays correct trial end date when starting enterprise trial', async () => {
    jest.mock('@sentry/scraps/alert');

    openAdminConfirmModal({
      onConfirm,
      renderModalSpecificContent: deps => (
        <TrialSubscriptionAction
          subscription={SubscriptionFixture({
            organization,
            plan: 'mm2_f',
            isFree: true,
          })}
          startEnterpriseTrial
          {...deps}
        />
      ),
    });

    renderGlobalModal();

    const daysInput = screen.getByRole('spinbutton', {name: 'Number of Days'});
    await userEvent.clear(daysInput);
    await userEvent.type(daysInput, '0');

    expect(daysInput).toHaveAccessibleDescription(
      `Their trial will end on ${formattedNow}`
    );
  });

  it('displays correct trial end date when extending trial', async () => {
    jest.mock('@sentry/scraps/alert');

    openAdminConfirmModal({
      onConfirm,
      renderModalSpecificContent: deps => (
        <TrialSubscriptionAction
          subscription={SubscriptionFixture({
            organization,
            trialEnd: trialEnd.toISOString(),
            plan: 'am1_t',
            isFree: true,
          })}
          {...deps}
        />
      ),
    });

    renderGlobalModal();

    const daysInput = screen.getByRole('spinbutton', {name: 'Number of Days'});
    await userEvent.clear(daysInput);
    await userEvent.type(daysInput, '0');

    expect(daysInput).toHaveAccessibleDescription(
      `Their trial will end on ${formattedTrialEnd}`
    );
  });

  it('displays correct trial end date when converting from trial to enterprise trial', async () => {
    jest.mock('@sentry/scraps/alert');

    openAdminConfirmModal({
      onConfirm,
      renderModalSpecificContent: deps => (
        <TrialSubscriptionAction
          subscription={SubscriptionFixture({
            organization,
            trialEnd: trialEnd.toISOString(),
            plan: 'am1_t',
            isFree: true,
          })}
          startEnterpriseTrial
          {...deps}
        />
      ),
    });

    renderGlobalModal();

    const daysInput = screen.getByRole('spinbutton', {name: 'Number of Days'});
    await userEvent.clear(daysInput);
    await userEvent.type(daysInput, '0');

    expect(daysInput).toHaveAccessibleDescription(
      `Their trial will end on ${formattedNow}`
    );
  });

  it('displays am3 trial tier option when free plan', async () => {
    jest.mock('@sentry/scraps/alert');

    openAdminConfirmModal({
      onConfirm,
      renderModalSpecificContent: deps => (
        <TrialSubscriptionAction
          subscription={SubscriptionFixture({
            organization,
            plan: 'am2_f',
            isFree: true,
            planTier: PlanTier.AM2,
          })}
          startEnterpriseTrial
          {...deps}
        />
      ),
    });

    renderGlobalModal();

    await userEvent.click(screen.getByTestId('trial-plan-tier-choices'));
    const trialTierInputs = within(screen.getByRole('dialog')).getAllByRole('textbox');
    await userEvent.click(trialTierInputs[1]!);
    expect(screen.getByText('am3')).toBeInTheDocument();
  });

  it('displays am3 trial tier option when am3 plan', async () => {
    jest.mock('@sentry/scraps/alert');

    openAdminConfirmModal({
      onConfirm,
      renderModalSpecificContent: deps => (
        <TrialSubscriptionAction
          subscription={SubscriptionFixture({
            organization,
            plan: 'am3_team',
            isFree: false,
            planTier: PlanTier.AM3,
          })}
          startEnterpriseTrial
          {...deps}
        />
      ),
    });

    renderGlobalModal();

    await userEvent.click(screen.getByTestId('trial-plan-tier-choices'));
    const trialTierInputs = within(screen.getByRole('dialog')).getAllByRole('textbox');
    await userEvent.click(trialTierInputs[1]!);
    expect(screen.getByText('am3')).toBeInTheDocument();
  });

  it('displays am3 trial tier option when am2 plan', async () => {
    jest.mock('@sentry/scraps/alert');

    openAdminConfirmModal({
      onConfirm,
      renderModalSpecificContent: deps => (
        <TrialSubscriptionAction
          subscription={SubscriptionFixture({
            organization,
            plan: 'am2_team',
            isFree: false,
            planTier: PlanTier.AM2,
          })}
          startEnterpriseTrial
          {...deps}
        />
      ),
    });

    renderGlobalModal();

    await userEvent.click(screen.getByTestId('trial-plan-tier-choices'));
    const trialTierInputs = within(screen.getByRole('dialog')).getAllByRole('textbox');
    await userEvent.click(trialTierInputs[1]!);
    expect(screen.getByText('am3')).toBeInTheDocument();
  });

  it('defaults 14-day trial for self-serve', () => {
    jest.mock('@sentry/scraps/alert');

    openAdminConfirmModal({
      onConfirm,
      renderModalSpecificContent: deps => (
        <TrialSubscriptionAction
          subscription={SubscriptionFixture({
            organization,
            plan: 'am3_business',
            isEnterpriseTrial: false,
          })}
          {...deps}
        />
      ),
    });

    renderGlobalModal();
    const daysInput = screen.getByRole('spinbutton', {name: 'Number of Days'});
    expect(daysInput).toHaveValue(14);
  });

  it('defaults 28-day trial for isEnterpriseTrial', () => {
    jest.mock('@sentry/scraps/alert');

    openAdminConfirmModal({
      onConfirm,
      renderModalSpecificContent: deps => (
        <TrialSubscriptionAction
          subscription={SubscriptionFixture({
            organization,
            plan: 'am3_business',
            isEnterpriseTrial: true,
          })}
          {...deps}
        />
      ),
    });

    renderGlobalModal();
    const daysInput = screen.getByRole('spinbutton', {name: 'Number of Days'});
    expect(daysInput).toHaveValue(28);
  });

  it('defaults 28-day trial for startEnterpriseTrial', () => {
    jest.mock('@sentry/scraps/alert');

    openAdminConfirmModal({
      onConfirm,
      renderModalSpecificContent: deps => (
        <TrialSubscriptionAction
          subscription={SubscriptionFixture({
            organization,
            plan: 'am3_business',
            isEnterpriseTrial: false,
          })}
          startEnterpriseTrial
          {...deps}
        />
      ),
    });

    renderGlobalModal();
    const daysInput = screen.getByRole('spinbutton', {name: 'Number of Days'});
    expect(daysInput).toHaveValue(28);
  });
});
