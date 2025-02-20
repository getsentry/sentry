import {OrganizationFixture} from 'sentry-fixture/organization';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';

import {BillingConfigFixture} from 'getsentry-test/fixtures/billingConfig';
import {BillingDetailsFixture} from 'getsentry-test/fixtures/billingDetails';
import {PlanDetailsLookupFixture} from 'getsentry-test/fixtures/planDetailsLookup';
import {ProjectFixture} from 'getsentry-test/fixtures/project';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {fireEvent, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription as SubscriptionType} from 'getsentry/types';
import {OnDemandBudgetMode, PlanTier} from 'getsentry/types';
import AMCheckout from 'getsentry/views/amCheckout';

describe('OnDemandBudgets AM Checkout', function () {
  const api = new MockApiClient();
  const organization = OrganizationFixture({
    features: ['ondemand-budgets'],
    access: ['org:billing'],
  });

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: `/subscriptions/${organization.slug}/`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      method: 'GET',
      body: organization,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      method: 'GET',
      body: [ProjectFixture({})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-config/`,
      method: 'GET',
      body: BillingConfigFixture(PlanTier.AM2),
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/preview/`,
      method: 'GET',
      body: {invoiceItems: []},
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/billing-details/`,
      method: 'GET',
      body: BillingDetailsFixture(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/promotions/trigger-check/`,
      method: 'POST',
    });
    MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/plan-migrations/?applied=0`,
      method: 'GET',
      body: {},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/monitor-count/`,
      method: 'GET',
      body: {enabledMonitorCount: 0, disabledMonitorCount: 0},
    });
  });

  const createWrapper = ({subscription}: {subscription: SubscriptionType}) => {
    SubscriptionStore.set(organization.slug, subscription);
    const params = {};
    return render(
      <AMCheckout
        {...RouteComponentPropsFixture()}
        params={params}
        api={api}
        organization={organization}
        checkoutTier={PlanTier.AM2}
        onToggleLegacy={jest.fn()}
      />
    );
  };

  it('AM checkout with legacy plan - shared budget', async function () {
    const subscription = SubscriptionFixture({
      organization,
      plan: 'mm2_f',
      onDemandMaxSpend: 1000,
    });
    const mockedEndpoint = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/`,
      method: 'PUT',
      body: {},
    });

    createWrapper({subscription});

    expect(await screen.findByText('On-Demand Max Spend')).toBeInTheDocument();

    await userEvent.click(screen.getByText('On-Demand Max Spend'));

    // set shared budget
    expect(screen.getByRole('textbox', {name: 'Monthly Max'})).toHaveValue('10');

    const onDemandInput = screen.getByRole('textbox', {name: 'Monthly Max'});
    await userEvent.clear(onDemandInput);
    await userEvent.type(onDemandInput, '42');
    expect(onDemandInput).toHaveValue('42');

    // Assert on-demand overview is rendered
    expect(screen.getByTestId('ondemand')).toHaveTextContent('On-Demand');
    expect(screen.getByTestId('ondemand')).toHaveTextContent('up to $42/mo');

    // Attempt to check out
    await userEvent.click(screen.getByText('Continue'));
    await userEvent.click(screen.getByText('Continue'));
    await userEvent.click(screen.getByText('Continue'));
    await userEvent.click(await screen.findByText('Current billing details on file'));
    await userEvent.click(screen.getByText('Continue'));
    expect(await screen.findByText('Confirm Changes')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Confirm Changes'));

    expect(mockedEndpoint).toHaveBeenCalledWith(
      '/customers/org-slug/subscription/',
      expect.objectContaining({
        data: expect.objectContaining({
          // Customers on a legacy plan should not have access to the new on-demand budgets UI, and thus,
          // onDemandBudget should be undefined.
          onDemandBudget: undefined,
          onDemandMaxSpend: 4200,
        }),
      })
    );
  });

  it('AM checkout with AM plan - per-category budget', async function () {
    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      planDetails: {
        ...PlanDetailsLookupFixture('am1_business')!,
      },
      organization,
      onDemandBudgets: {
        enabled: false,
        sharedMaxBudget: 0,
        budgetMode: OnDemandBudgetMode.SHARED,
        onDemandSpendUsed: 0,
      },
    });
    const mockedEndpoint = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/`,
      method: 'PUT',
      body: {},
    });

    createWrapper({subscription});

    expect(await screen.findByText('On-Demand Budgets')).toBeInTheDocument();

    await userEvent.click(screen.getByText('On-Demand Budgets'));

    expect(screen.getByTestId('per-category-budget-radio')).not.toBeChecked();
    expect(screen.getByTestId('shared-budget-radio')).toBeChecked();

    expect(screen.getByRole('textbox', {name: 'Shared max budget'})).toHaveValue('0');

    // set per-category budgets
    await userEvent.click(screen.getByTestId('per-category-budget-radio'));

    fireEvent.change(screen.getByRole('textbox', {name: 'Errors budget'}), {
      target: {value: '10'},
    });
    fireEvent.change(screen.getByRole('textbox', {name: 'Performance units budget'}), {
      target: {value: '20'},
    });
    fireEvent.change(screen.getByRole('textbox', {name: 'Attachments budget'}), {
      target: {value: '30'},
    });
    fireEvent.change(screen.getByRole('textbox', {name: 'Cron monitors budget'}), {
      target: {value: '40'},
    });

    // Assert on-demand overview is rendered
    expect(screen.getByTestId('ondemand')).toHaveTextContent('Per-Category On-Demand');
    expect(screen.getByTestId('ondemand')).toHaveTextContent('Errorsup to $10/mo');
    expect(screen.getByTestId('ondemand')).toHaveTextContent(
      'Performance unitsup to $20/mo'
    );
    expect(screen.getByTestId('ondemand')).toHaveTextContent('Attachmentsup to $30/mo');

    // Attempt to check out
    await userEvent.click(screen.getByText('Continue'));
    await userEvent.click(screen.getByText('Continue'));
    await userEvent.click(screen.getByText('Continue'));
    await userEvent.click(await screen.findByText('Current billing details on file'));
    await userEvent.click(screen.getByText('Continue'));
    expect(await screen.findByText('Confirm Changes')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Confirm Changes'));

    expect(mockedEndpoint).toHaveBeenCalledWith(
      '/customers/org-slug/subscription/',
      expect.objectContaining({
        data: expect.objectContaining({
          onDemandBudget: {
            budgetMode: 'per_category',
            errorsBudget: 1000,
            transactionsBudget: 2000,
            attachmentsBudget: 3000,
            monitorSeatsBudget: 4000,
            replaysBudget: 0,
            budgets: {
              errors: 1000,
              transactions: 2000,
              attachments: 3000,
              replays: 0,
              monitorSeats: 4000,
            },
          },
          onDemandMaxSpend: 1000 + 2000 + 3000 + 4000,
        }),
      })
    );
  });

  it('AM checkout with AM plan - shared budget', async function () {
    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      planDetails: {
        ...PlanDetailsLookupFixture('am1_business')!,
      },
      organization,
      onDemandBudgets: {
        enabled: false,
        sharedMaxBudget: 0,
        budgetMode: OnDemandBudgetMode.SHARED,
        onDemandSpendUsed: 0,
      },
    });
    const mockedEndpoint = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/`,
      method: 'PUT',
      body: {},
    });

    createWrapper({subscription});

    expect(await screen.findByText('On-Demand Budgets')).toBeInTheDocument();

    await userEvent.click(screen.getByText('On-Demand Budgets'));

    expect(screen.getByTestId('per-category-budget-radio')).not.toBeChecked();
    expect(screen.getByTestId('shared-budget-radio')).toBeChecked();

    expect(screen.getByRole('textbox', {name: 'Shared max budget'})).toHaveValue('0');

    // set shared
    fireEvent.change(screen.getByRole('textbox', {name: 'Shared max budget'}), {
      target: {value: '42'},
    });

    // Assert on-demand overview is rendered
    expect(screen.getByTestId('ondemand')).toHaveTextContent('Shared On-Demand');
    expect(screen.getByTestId('ondemand')).toHaveTextContent('up to $42/mo');

    // Attempt to check out
    await userEvent.click(screen.getByText('Continue'));
    await userEvent.click(screen.getByText('Continue'));
    await userEvent.click(screen.getByText('Continue'));
    await userEvent.click(await screen.findByText('Current billing details on file'));
    await userEvent.click(screen.getByText('Continue'));
    expect(await screen.findByText('Confirm Changes')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Confirm Changes'));

    expect(mockedEndpoint).toHaveBeenCalledWith(
      '/customers/org-slug/subscription/',
      expect.objectContaining({
        data: expect.objectContaining({
          onDemandBudget: {budgetMode: 'shared', sharedMaxBudget: 4200},
          onDemandMaxSpend: 4200,
        }),
      })
    );
  });

  it('AM checkout with AM plan - turn off on-demand', async function () {
    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: true,
      planDetails: {
        ...PlanDetailsLookupFixture('am1_business')!,
      },
      organization,
      onDemandBudgets: {
        enabled: false,
        budgetMode: OnDemandBudgetMode.PER_CATEGORY,
        replaysBudget: 0,
        attachmentSpendUsed: 0,
        errorSpendUsed: 0,
        transactionSpendUsed: 0,
        usedSpends: {errors: 0, transactions: 0, attachments: 0, replays: 0},
        errorsBudget: 1000,
        transactionsBudget: 2000,
        attachmentsBudget: 3000,
        budgets: {errors: 1000, transactions: 2000, attachments: 3000},
      },
    });
    const mockedEndpoint = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/`,
      method: 'PUT',
      body: {},
    });

    createWrapper({subscription});

    expect(await screen.findByText('On-Demand Budgets')).toBeInTheDocument();

    await userEvent.click(screen.getByText('On-Demand Budgets'));

    expect(screen.getByTestId('per-category-budget-radio')).toBeChecked();
    expect(screen.getByTestId('shared-budget-radio')).not.toBeChecked();

    expect(screen.getByRole('textbox', {name: 'Errors budget'})).toHaveValue('10');
    expect(screen.getByRole('textbox', {name: 'Performance units budget'})).toHaveValue(
      '20'
    );
    expect(screen.getByRole('textbox', {name: 'Attachments budget'})).toHaveValue('30');

    // turn off on-demand
    await userEvent.click(screen.getByTestId('per-category-budget-radio'));

    fireEvent.change(screen.getByRole('textbox', {name: 'Errors budget'}), {
      target: {value: '0'},
    });
    fireEvent.change(screen.getByRole('textbox', {name: 'Performance units budget'}), {
      target: {value: '0'},
    });
    fireEvent.change(screen.getByRole('textbox', {name: 'Attachments budget'}), {
      target: {value: '0'},
    });

    // Assert on-demand overview is not rendered
    expect(screen.queryByTestId('ondemand')).not.toBeInTheDocument();

    // Attempt to check out
    await userEvent.click(screen.getByText('Continue'));
    await userEvent.click(screen.getByText('Continue'));
    await userEvent.click(screen.getByText('Continue'));
    await userEvent.click(await screen.findByText('Current billing details on file'));
    await userEvent.click(screen.getByText('Continue'));
    expect(await screen.findByText('Confirm Changes')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Confirm Changes'));

    expect(mockedEndpoint).toHaveBeenCalledWith(
      '/customers/org-slug/subscription/',
      expect.objectContaining({
        data: expect.objectContaining({
          onDemandBudget: {
            budgetMode: 'shared',
            sharedMaxBudget: 0,
          },
          onDemandMaxSpend: 0,
        }),
      })
    );
  });

  it('AM checkout with AM plan - on-demand not supported', async function () {
    const subscription = SubscriptionFixture({
      plan: 'am1_business',
      planTier: PlanTier.AM1,
      isFree: false,
      isTrial: false,
      supportsOnDemand: false,
      planDetails: {
        ...PlanDetailsLookupFixture('am1_business')!,
      },
      organization,
      onDemandBudgets: {
        enabled: false,
        budgetMode: OnDemandBudgetMode.SHARED,
        onDemandSpendUsed: 0,
        sharedMaxBudget: 0,
      },
    });
    const mockedEndpoint = MockApiClient.addMockResponse({
      url: `/customers/${organization.slug}/subscription/`,
      method: 'PUT',
      body: {},
    });

    createWrapper({subscription});

    expect(await screen.findByText('On-Demand Budgets')).toBeInTheDocument();

    await userEvent.click(screen.getByText('On-Demand Budgets'));

    const perCategoryBudgetRadio = screen.getByTestId('per-category-budget-radio');
    expect(perCategoryBudgetRadio).not.toBeChecked();
    expect(perCategoryBudgetRadio).toBeDisabled();

    const sharedBudgetRadio = screen.getByTestId('shared-budget-radio');
    expect(sharedBudgetRadio).toBeChecked();
    expect(sharedBudgetRadio).toBeDisabled();

    const sharedBudgetInput = screen.getByRole('textbox', {
      name: 'Shared max budget',
    });
    expect(sharedBudgetInput).toHaveValue('0');
    expect(sharedBudgetInput).toBeDisabled();

    // Assert on-demand overview is not rendered
    expect(screen.queryByTestId('ondemand')).not.toBeInTheDocument();

    // Attempt to check out
    await userEvent.click(screen.getByText('Continue'));
    await userEvent.click(screen.getByText('Continue'));
    await userEvent.click(screen.getByText('Continue'));
    await userEvent.click(await screen.findByText('Current billing details on file'));
    await userEvent.click(screen.getByText('Continue'));
    expect(await screen.findByText('Confirm Changes')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Confirm Changes'));

    expect(mockedEndpoint).toHaveBeenCalledWith(
      '/customers/org-slug/subscription/',
      expect.objectContaining({
        data: expect.objectContaining({
          onDemandBudget: {budgetMode: 'shared', sharedMaxBudget: 0},
          onDemandMaxSpend: 0,
        }),
      })
    );
  });
});
