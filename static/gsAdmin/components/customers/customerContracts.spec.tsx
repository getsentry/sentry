import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {CustomerContracts} from 'admin/components/customers/customerContracts';

describe('CustomerContracts', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders each contract with its overrides and package', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/customers/acme/contracts/',
      body: [
        {
          contract: {
            metadata: {id: '42', packageUid: 'am3_team'},
            billingConfig: {monthInterval: 1, creditCard: {}},
            pricingConfig: {
              ondemandPeriodStartDate: {year: 2026, month: 10, day: 1},
              ondemandPeriodEndDate: {year: 2026, month: 11, day: 1},
              userConfig: [
                {
                  specificItems: {uids: ['errors']},
                  reservation: {numReservedUnits: '100000', reservedPriceCents: '2900'},
                },
                {allItems: {}, paygBudget: {budgetCents: '5000'}},
              ],
            },
            retentionConfig: {organizationDays: 90, overrides: []},
          },
          package: {
            uid: 'am3_team',
            adminTitle: 'AM3 Team',
            flexibleBasePriceCents: {base: '2600'},
            lineItemConfigs: [
              {
                lineItem: {uid: 'errors', customerFacingName: 'Errors'},
                numReservedUnits: '50000',
              },
            ],
          },
        },
      ],
    });

    render(<CustomerContracts orgId="acme" />);

    expect(await screen.findByText('42')).toBeInTheDocument();
    expect(screen.getByText('Credit Card, Monthly')).toBeInTheDocument();
    expect(screen.getByText('Errors: Reserved 100,000 for $29.00')).toBeInTheDocument();
    expect(screen.getByText('All line items: PAYG budget $50.00')).toBeInTheDocument();
    expect(screen.getByText('Organization retention: 90 days')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'AM3 Team ($26.00)'}));
    expect(screen.getByText('Errors: 50,000 included')).toBeInTheDocument();
  });

  it('flags a contract whose package is unknown', async () => {
    MockApiClient.addMockResponse({
      url: '/_admin/customers/acme/contracts/',
      body: [{contract: {metadata: {id: '7', packageUid: 'gone'}}, package: null}],
    });

    render(<CustomerContracts orgId="acme" />);

    expect(await screen.findByText('Unknown package gone')).toBeInTheDocument();
  });
});
