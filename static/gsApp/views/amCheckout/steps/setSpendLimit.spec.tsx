import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {Client} from 'sentry/api';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout';

describe('SetSpendLimit', () => {
  let api: Client;
  const organization = OrganizationFixture({
    features: ['ondemand-budgets', 'am3-billing'],
  });
  const preAm3Organization = OrganizationFixture({
    features: ['ondemand-budgets'],
  });

  beforeEach(() => {
    api = new MockApiClient();
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/preview/`,
      method: 'GET',
      body: {
        invoiceItems: [],
      },
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
    });
  });
  it('renders for AM3 tier', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM3),
    });
    const sub = SubscriptionFixture({
      organization,
      plan: 'am3_f',
      planTier: PlanTier.AM3,
    });
    SubscriptionStore.set(organization.slug, sub);
    render(
      <AMCheckout
        {...RouteComponentPropsFixture({})}
        api={api}
        organization={organization}
        checkoutTier={PlanTier.AM3}
        navigate={jest.fn()}
      />
    );

    expect(await screen.findByText('Set your pay-as-you-go limit')).toBeInTheDocument();
    expect(
      screen.queryByRole('radio', {name: 'Shared spending limit mode'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('radio', {name: 'Per-category spending limit mode'})
    ).not.toBeInTheDocument();
    const paygInput = screen.getByRole('textbox', {
      name: 'Custom shared spending limit (in dollars)',
    });
    expect(paygInput).toHaveValue('300'); // default business budget
    expect(
      screen.queryByRole('textbox', {name: 'Custom errors spending limit (in dollars)'})
    ).not.toBeInTheDocument();
  });

  it('renders for pre-AM3 tier', async () => {
    MockApiClient.addMockResponse({
      url: `/customers/${preAm3Organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM2),
    });
    const sub = SubscriptionFixture({
      organization: preAm3Organization,
      plan: 'am2_team',
      planTier: PlanTier.AM2,
    });
    SubscriptionStore.set(preAm3Organization.slug, sub);
    render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        api={api}
        organization={preAm3Organization}
        checkoutTier={PlanTier.AM2}
        navigate={jest.fn()}
      />
    );

    expect(await screen.findByText('Set your on-demand limit')).toBeInTheDocument();
    expect(
      screen.getByRole('radio', {name: 'Shared spending limit mode'})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('textbox', {name: 'Custom shared spending limit (in dollars)'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', {name: 'Custom errors spending limit (in dollars)'})
    ).not.toBeInTheDocument();

    const perCategoryRadio = screen.getByRole('radio', {
      name: 'Per-category spending limit mode',
    });
    expect(perCategoryRadio).toBeInTheDocument();
    await userEvent.click(perCategoryRadio);

    expect(
      screen.queryByRole('textbox', {name: 'Custom shared spending limit (in dollars)'})
    ).not.toBeInTheDocument();
    const errorsPaygInput = screen.getByRole('textbox', {
      name: 'Custom errors spending limit (in dollars)',
    });
    expect(errorsPaygInput).toBeInTheDocument();
  });
});
