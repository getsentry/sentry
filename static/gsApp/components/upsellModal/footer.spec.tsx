import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import Footer from 'getsentry/components/upsellModal/footer';

describe('Business Landing Footer', function () {
  const organization = OrganizationFixture({access: ['org:billing']});
  const subscription = SubscriptionFixture({organization});

  const checkoutPage = `/settings/${organization.slug}/billing/checkout/?referrer=upgrade-business-landing.unknown`;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: subscription,
    });
  });

  it('renders start trial if can trial', async function () {
    render(
      <Footer
        subscription={{
          ...subscription,
          plan: 'mm2_f',
          canTrial: true,
          isTrial: false,
        }}
        organization={organization}
        onCloseModal={jest.fn()}
      />
    );
    expect(await screen.findByText('Learn more and compare plans')).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Upgrade now'})).toBeInTheDocument();
    expect(
      await screen.findByRole('button', {name: 'Start 14-Day Trial'})
    ).toBeInTheDocument();
  });

  it('renders upgrade button if trialing', async function () {
    render(
      <Footer
        subscription={{
          ...subscription,
          plan: 'am1_t',
          canTrial: false,
          isTrial: true,
        }}
        organization={organization}
        onCloseModal={jest.fn()}
      />
    );
    expect(await screen.findByText('Learn more and compare plans')).toBeInTheDocument();
    expect(screen.queryByText('Start 14-Day Trial')).not.toBeInTheDocument();

    const button = await screen.findByRole('button', {name: 'Upgrade now'});
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('href', checkoutPage);
  });

  it('renders upgrade button if cannot trial and not trialing', async function () {
    render(
      <Footer
        subscription={{
          ...subscription,
          plan: 'mm2_f',
          canTrial: false,
          isTrial: false,
        }}
        organization={organization}
        onCloseModal={jest.fn()}
      />
    );
    const button = await screen.findByRole('button', {name: 'Upgrade now'});
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('href', checkoutPage);

    expect(screen.queryByText('Start 14-Day Trial')).not.toBeInTheDocument();
  });

  it('directs to checkout if cannot trial and not trialing', async function () {
    render(
      <Footer
        subscription={{
          ...subscription,
          plan: 'mm2_a_500k',
          canTrial: false,
          isTrial: false,
        }}
        organization={organization}
        onCloseModal={jest.fn()}
      />
    );
    const button = await screen.findByRole('button', {name: 'Upgrade now'});
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('href', checkoutPage);

    expect(screen.queryByText(/trial/i)).not.toBeInTheDocument();
  });

  it('click request upgrade button if no billing permissions', async function () {
    const upgradeRequest = MockApiClient.addMockResponse({
      method: 'POST',
      url: `/organizations/${organization.slug}/plan-upgrade-request/`,
      body: {},
    });

    const onCloseModal = jest.fn();

    render(
      <Footer
        subscription={{
          ...subscription,
          plan: 'mm2_f',
          canTrial: false,
          isTrial: false,
        }}
        organization={OrganizationFixture({
          ...organization,
          access: [],
        })}
        onCloseModal={onCloseModal}
      />
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Request Upgrade'}));

    await waitFor(() => {
      expect(onCloseModal).toHaveBeenCalled();
    });
    expect(upgradeRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/plan-upgrade-request/`,
      expect.objectContaining({
        method: 'POST',
        data: {},
      })
    );
  });

  it('click request trial button if no billing permissions', async function () {
    const upgradeRequest = MockApiClient.addMockResponse({
      method: 'POST',
      url: `/organizations/${organization.slug}/trial-request/`,
      body: {},
    });

    const onCloseModal = jest.fn();

    render(
      <Footer
        subscription={{
          ...subscription,
          plan: 'mm2_f',
          canTrial: true,
          isTrial: false,
        }}
        organization={OrganizationFixture({
          ...organization,
          access: [],
        })}
        onCloseModal={onCloseModal}
      />
    );

    // there's a secondary upgrade button
    await userEvent.click(await screen.findByRole('button', {name: 'Request Trial'}));

    await waitFor(() => {
      expect(onCloseModal).toHaveBeenCalled();
    });
    expect(upgradeRequest).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/trial-request/`,
      expect.objectContaining({
        method: 'POST',
        data: {},
      })
    );
  });
});
