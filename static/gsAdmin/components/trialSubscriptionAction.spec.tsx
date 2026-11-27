import moment from 'moment-timezone';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from '@sentry/scraps/modal';

import {TrialSubscriptionAction} from 'admin/components/trialSubscriptionAction';

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
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));
  }

  it('can pass trialDays onConfirm', async () => {
    openModal(deps => (
      <TrialSubscriptionAction
        subscription={SubscriptionFixture({organization})}
        {...deps}
        onConfirm={onConfirm}
      />
    ));

    renderGlobalModal();
    await confirmTrialDays('30');

    expect(onConfirm).toHaveBeenCalledWith({trialDays: 30});
  });

  it('can pass trialDays and enterprise plan onConfirm', async () => {
    jest.mock('@sentry/scraps/alert');

    openModal(deps => (
      <TrialSubscriptionAction
        subscription={SubscriptionFixture({organization, plan: 'mm2_f', isFree: true})}
        startEnterpriseTrial
        {...deps}
        onConfirm={onConfirm}
      />
    ));

    renderGlobalModal();

    expect(
      screen.getByText('Spike protection will need to be manually disabled.')
    ).toBeInTheDocument();
    await confirmTrialDays('45');

    expect(onConfirm).toHaveBeenCalledWith({trialDays: 45, startEnterpriseTrial: true});
  });

  it('can pass trialDays and extend enterprise plan onConfirm', async () => {
    jest.mock('@sentry/scraps/alert');

    openModal(deps => (
      <TrialSubscriptionAction
        subscription={SubscriptionFixture({
          organization,
          plan: 'mm2_a_500k',
          isFree: false,
          isEnterpriseTrial: true,
        })}
        {...deps}
        onConfirm={onConfirm}
      />
    ));

    renderGlobalModal();
    await confirmTrialDays('21');

    expect(onConfirm).toHaveBeenCalledWith({trialDays: 21});
  });

  it('shows an error and does not confirm for zero days', async () => {
    const onConfirmInvalid = jest.fn();
    openModal(deps => (
      <TrialSubscriptionAction
        subscription={SubscriptionFixture({organization})}
        {...deps}
        onConfirm={onConfirmInvalid}
      />
    ));

    renderGlobalModal();
    await confirmTrialDays('0');

    expect(
      await screen.findByText('Enter a number of days greater than zero')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Confirm'})).toBeEnabled();
    expect(onConfirmInvalid).not.toHaveBeenCalled();
  });

  it('shows an error and does not confirm when days are cleared', async () => {
    const onConfirmEmpty = jest.fn();
    openModal(deps => (
      <TrialSubscriptionAction
        subscription={SubscriptionFixture({organization})}
        {...deps}
        onConfirm={onConfirmEmpty}
      />
    ));

    renderGlobalModal();
    await userEvent.clear(screen.getByRole('spinbutton', {name: 'Number of Days'}));
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(
      await screen.findByText('Enter a number of days greater than zero')
    ).toBeInTheDocument();
    expect(onConfirmEmpty).not.toHaveBeenCalled();
  });

  it('displays correct trial end date when starting trial', async () => {
    jest.mock('@sentry/scraps/alert');

    openModal(deps => (
      <TrialSubscriptionAction
        subscription={SubscriptionFixture({organization, plan: 'mm2_f', isFree: true})}
        {...deps}
        onConfirm={onConfirm}
      />
    ));

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

    openModal(deps => (
      <TrialSubscriptionAction
        subscription={SubscriptionFixture({organization, plan: 'mm2_f', isFree: true})}
        startEnterpriseTrial
        {...deps}
        onConfirm={onConfirm}
      />
    ));

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

    openModal(deps => (
      <TrialSubscriptionAction
        subscription={SubscriptionFixture({
          organization,
          trialEnd: trialEnd.toISOString(),
          plan: 'am1_t',
          isFree: true,
        })}
        {...deps}
        onConfirm={onConfirm}
      />
    ));

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

    openModal(deps => (
      <TrialSubscriptionAction
        subscription={SubscriptionFixture({
          organization,
          trialEnd: trialEnd.toISOString(),
          plan: 'am1_t',
          isFree: true,
        })}
        startEnterpriseTrial
        {...deps}
        onConfirm={onConfirm}
      />
    ));

    renderGlobalModal();

    const daysInput = screen.getByRole('spinbutton', {name: 'Number of Days'});
    await userEvent.clear(daysInput);
    await userEvent.type(daysInput, '0');

    expect(daysInput).toHaveAccessibleDescription(
      `Their trial will end on ${formattedNow}`
    );
  });

  it('defaults 14-day trial for self-serve', () => {
    jest.mock('@sentry/scraps/alert');

    openModal(deps => (
      <TrialSubscriptionAction
        subscription={SubscriptionFixture({
          organization,
          plan: 'am3_business',
          isEnterpriseTrial: false,
        })}
        {...deps}
        onConfirm={onConfirm}
      />
    ));

    renderGlobalModal();
    const daysInput = screen.getByRole('spinbutton', {name: 'Number of Days'});
    expect(daysInput).toHaveValue(14);
  });

  it('defaults 28-day trial for isEnterpriseTrial', () => {
    jest.mock('@sentry/scraps/alert');

    openModal(deps => (
      <TrialSubscriptionAction
        subscription={SubscriptionFixture({
          organization,
          plan: 'am3_business',
          isEnterpriseTrial: true,
        })}
        {...deps}
        onConfirm={onConfirm}
      />
    ));

    renderGlobalModal();
    const daysInput = screen.getByRole('spinbutton', {name: 'Number of Days'});
    expect(daysInput).toHaveValue(28);
  });

  it('defaults 28-day trial for startEnterpriseTrial', () => {
    jest.mock('@sentry/scraps/alert');

    openModal(deps => (
      <TrialSubscriptionAction
        subscription={SubscriptionFixture({
          organization,
          plan: 'am3_business',
          isEnterpriseTrial: false,
        })}
        startEnterpriseTrial
        {...deps}
        onConfirm={onConfirm}
      />
    ));

    renderGlobalModal();
    const daysInput = screen.getByRole('spinbutton', {name: 'Number of Days'});
    expect(daysInput).toHaveValue(28);
  });
});
