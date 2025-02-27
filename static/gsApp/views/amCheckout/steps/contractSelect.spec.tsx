import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription as SubscriptionType} from 'getsentry/types';
import {PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout/';

describe('ContractSelect', function () {
  const api = new MockApiClient();
  const organization = OrganizationFixture();
  const subscription = SubscriptionFixture({organization});
  const params = {};

  const warningText = /You are currently on an annual contract/;

  function renderView() {
    return render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        onToggleLegacy={jest.fn()}
        checkoutTier={PlanTier.AM2}
        organization={organization}
      />
    );
  }

  beforeEach(function () {
    SubscriptionStore.set(organization.slug, subscription);

    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM2),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      method: 'GET',
      body: [],
    });
  });

  it('renders', async function () {
    renderView();

    const header = await screen.findByTestId('header-contract-term-discounts');
    expect(within(header).getByText('Contract Term & Discounts')).toBeInTheDocument();
    // Panel starts off closed.
    expect(screen.queryByText('Monthly')).not.toBeInTheDocument();
    expect(screen.queryByText('Annual Contract')).not.toBeInTheDocument();

    await userEvent.click(within(header).getByLabelText('Expand section'));

    // Panel should be open and options visible.
    expect(screen.getByText('Monthly')).toBeInTheDocument();
    expect(screen.getByText('Annual Contract')).toBeInTheDocument();
    expect(screen.getByDisplayValue('monthly')).toBeInTheDocument();
    expect(screen.getByDisplayValue('annual')).toBeInTheDocument();
  });

  it('renders with correct default prices', async function () {
    renderView();

    // Open the section.
    const header = await screen.findByTestId('header-contract-term-discounts');
    await userEvent.click(within(header).getByLabelText('Expand section'));

    expect(screen.getByRole('radio', {name: 'Monthly'})).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Annual Contract'})).toBeInTheDocument();
  });

  it('can select contract term', async function () {
    renderView();

    // Open the section.
    const header = await screen.findByTestId('header-contract-term-discounts');
    await userEvent.click(within(header).getByLabelText('Expand section'));

    await userEvent.click(screen.getByRole('radio', {name: 'Monthly'}));
    expect(screen.getByRole('radio', {name: 'Monthly'})).toBeChecked();

    await userEvent.click(screen.getByRole('radio', {name: 'Annual Contract'}));
    expect(screen.getByRole('radio', {name: 'Annual Contract'})).toBeChecked();
  });

  it('can complete step', async function () {
    renderView();

    // Open the section.
    const header = await screen.findByTestId('header-contract-term-discounts');
    await userEvent.click(within(header).getByLabelText('Expand section'));

    // Choose monthly
    await userEvent.click(screen.getByRole('radio', {name: 'Monthly'}));
    expect(screen.getByRole('radio', {name: 'Monthly'})).toBeChecked();

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    // Radio should hide
    expect(screen.queryByRole('radio', {name: 'Monthly'})).not.toBeInTheDocument();
    expect(within(header).getByText('Edit')).toBeInTheDocument();
  });

  it('renders annual contract warning', async function () {
    const sub: SubscriptionType = {...subscription, contractInterval: 'annual'};
    SubscriptionStore.set(organization.slug, sub);

    renderView();
    // Open the section
    const header = await screen.findByTestId('header-contract-term-discounts');
    await userEvent.click(within(header).getByLabelText('Expand section'));

    // Stay on annual contract
    await userEvent.click(screen.getByRole('radio', {name: 'Annual Contract'}));
    expect(screen.queryByText(warningText)).not.toBeInTheDocument();

    // Going to monthly should show a warning
    await userEvent.click(screen.getByRole('radio', {name: 'Monthly'}));
    expect(screen.getByText(warningText)).toBeInTheDocument();
  });

  it('does not render annual contract warning for monthly plan', async function () {
    renderView();
    // Open the section
    const header = await screen.findByTestId('header-contract-term-discounts');
    await userEvent.click(within(header).getByLabelText('Expand section'));

    // Choosing annual = no warning.
    await userEvent.click(screen.getByRole('radio', {name: 'Annual Contract'}));
    expect(screen.queryByText(warningText)).not.toBeInTheDocument();

    // Same for monthly.
    await userEvent.click(screen.getByRole('radio', {name: 'Monthly'}));
    expect(screen.queryByText(warningText)).not.toBeInTheDocument();
  });

  it('does not render annual contract warning for FL sponsored plan', async function () {
    const sub: SubscriptionType = {
      ...subscription,
      contractInterval: 'annual',
      sponsoredType: 'FOO',
      partner: {
        isActive: true,
        externalId: 'foo',
        partnership: {
          id: 'FL',
          displayName: 'FOO',
          supportNote: '',
        },
        name: '',
      },
    };

    SubscriptionStore.set(organization.slug, sub);
    renderView();

    // Open the section
    const header = await screen.findByTestId('header-contract-term-discounts');
    await userEvent.click(within(header).getByLabelText('Expand section'));

    // Choosing annual = no warning.
    await userEvent.click(screen.getByRole('radio', {name: 'Annual Contract'}));
    expect(screen.queryByText(warningText)).not.toBeInTheDocument();

    // Same for monthly.
    await userEvent.click(screen.getByRole('radio', {name: 'Monthly'}));
    expect(screen.queryByText(warningText)).not.toBeInTheDocument();
  });
});
