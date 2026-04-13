import {render, screen} from 'sentry-test/reactTestingLibrary';

import {CustomerContractDetails} from 'admin/views/customerContractDetails';

const MOCK_CONTRACT = {
  metadata: {id: 'contract-123', organizationId: 'org-456'},
  billingConfig: {
    billingType: 'BILLING_TYPE_CREDIT_CARD',
    channel: 'CHANNEL_SALES',
    address: {countryCode: 'US'},
    contractStartDate: {year: 2024, month: 1, day: 1},
    contractEndDate: {year: 2025, month: 1, day: 1},
  },
  pricingConfig: {
    skuConfigs: [
      {
        sku: 'SKU_ERRORS',
        basePriceCents: '10000',
        paygBudgetCents: '5000',
        reservedVolume: '100000',
        reservedRate: {tiers: [{ratePerUnitCpe: '100'}]},
        paygRate: {tiers: [{ratePerUnitCpe: '200'}]},
      },
    ],
    sharedSkuBudgets: [],
    billingPeriodStartDate: {year: 2024, month: 1, day: 1},
    billingPeriodEndDate: {year: 2024, month: 2, day: 1},
    maxSpendCents: '50000',
    basePriceCents: '10000',
  },
};

const ROUTER_CONFIG = {
  location: {pathname: '/_admin/customers/test-org/contract/'},
  route: '/_admin/customers/:orgId/contract/',
};

describe('CustomerContractDetails', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders contract data', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/customers/test-org/contract/',
      body: MOCK_CONTRACT,
    });

    render(<CustomerContractDetails />, {
      initialRouterConfig: ROUTER_CONFIG,
    });

    expect(await screen.findByText('Contract Overview')).toBeInTheDocument();

    expect(screen.getByText('Billing Period:')).toBeInTheDocument();
    expect(screen.getByText('Contract Period:')).toBeInTheDocument();
    expect(screen.getAllByText('Base Price:').length).toBeGreaterThan(0);
    expect(screen.getByText('Max Spend:')).toBeInTheDocument();
    expect(screen.getByText('Contract ID:')).toBeInTheDocument();
    expect(screen.getByText('Type:')).toBeInTheDocument();
    expect(screen.getByText('Channel:')).toBeInTheDocument();
    expect(screen.getByText('Billing Country:')).toBeInTheDocument();

    expect(screen.getByText('contract-123')).toBeInTheDocument();
    expect(screen.getByText('Credit Card')).toBeInTheDocument();
    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.getByText('United States')).toBeInTheDocument();

    expect(screen.getByText('SKU Pricing')).toBeInTheDocument();
    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('Reserved Volume:')).toBeInTheDocument();
    expect(screen.getByText('100,000')).toBeInTheDocument();
    expect(screen.getByText('$0.00000100')).toBeInTheDocument();
    expect(screen.getByText('$0.00000200')).toBeInTheDocument();
  });

  it('renders error state', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/customers/test-org/contract/',
      body: {detail: 'Not found'},
      statusCode: 404,
    });

    render(<CustomerContractDetails />, {
      initialRouterConfig: ROUTER_CONFIG,
    });

    expect(
      await screen.findByText('There was an error loading data.')
    ).toBeInTheDocument();
  });

  it('renders shared budgets when present', async () => {
    const contractWithBudgets = {
      ...MOCK_CONTRACT,
      pricingConfig: {
        ...MOCK_CONTRACT.pricingConfig,
        sharedSkuBudgets: [
          {
            skus: ['SKU_ERRORS', 'SKU_TRANSACTIONS'],
            reservedBudgetCents: '20000',
            paygBudgetCents: '10000',
          },
        ],
      },
    };

    MockApiClient.addMockResponse({
      url: '/_admin/customers/test-org/contract/',
      body: contractWithBudgets,
    });

    render(<CustomerContractDetails />, {
      initialRouterConfig: ROUTER_CONFIG,
    });

    expect(await screen.findByText('Shared Budgets')).toBeInTheDocument();
    expect(screen.getByText('Errors, Transactions')).toBeInTheDocument();
    expect(screen.getByText('Reserved Budget:')).toBeInTheDocument();
    expect(screen.getAllByText('PAYG Budget:').length).toBeGreaterThan(0);
  });

  it('handles missing optional fields gracefully', async () => {
    const minimalContract = {
      metadata: {},
      billingConfig: {},
      pricingConfig: {},
    };

    MockApiClient.addMockResponse({
      url: '/_admin/customers/test-org/contract/',
      body: minimalContract,
    });

    render(<CustomerContractDetails />, {
      initialRouterConfig: ROUTER_CONFIG,
    });

    expect(await screen.findByText('Contract Overview')).toBeInTheDocument();
    expect(screen.getAllByText('N/A').length).toBeGreaterThan(0);
  });
});
