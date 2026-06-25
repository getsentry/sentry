import {ThemeProvider} from '@emotion/react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {BillingDetailsFixture} from 'getsentry-test/fixtures/billingDetails';
import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {lightTheme} from 'sentry/utils/theme/theme';

import {BillingDetailsPanel} from 'getsentry/components/billingDetails/panel';
import {useBillingDetails} from 'getsentry/hooks/useBillingDetails';
import type {BillingDetails, Subscription} from 'getsentry/types';

jest.mock('getsentry/hooks/useBillingDetails');

const mockUseBillingDetails = jest.mocked(useBillingDetails);

const organization = OrganizationFixture();

const emptyDetails: BillingDetails = {
  addressLine1: null,
  addressLine2: null,
  city: null,
  countryCode: null,
  postalCode: null,
  region: null,
  addressType: null,
  billingEmail: null,
  companyName: null,
  displayAddress: null,
  taxNumber: null,
};

type Scenario = {
  details: BillingDetails;
  subscription: Subscription;
};

const SCENARIOS: Record<string, Scenario> = {
  empty: {
    details: emptyDetails,
    subscription: SubscriptionFixture({organization, accountBalance: 0}),
  },
  'full-with-address': {
    details: BillingDetailsFixture(),
    subscription: SubscriptionFixture({organization, accountBalance: -2500}),
  },
  'address-only': {
    details: BillingDetailsFixture({
      billingEmail: null,
      companyName: null,
      taxNumber: null,
    }),
    subscription: SubscriptionFixture({organization, accountBalance: 0}),
  },
  'email-only-no-address': {
    details: {...emptyDetails, billingEmail: 'billing@example.com'},
    subscription: SubscriptionFixture({organization, accountBalance: 0}),
  },
  'without-email': {
    details: BillingDetailsFixture({billingEmail: null}),
    subscription: SubscriptionFixture({organization, accountBalance: 0}),
  },
  'tax-number-vat': {
    details: BillingDetailsFixture({countryCode: 'GB', taxNumber: 'GB123456789'}),
    subscription: SubscriptionFixture({organization, accountBalance: 0}),
  },
  'no-tax-country': {
    details: BillingDetailsFixture({countryCode: 'US', taxNumber: 'IGNORED'}),
    subscription: SubscriptionFixture({organization, accountBalance: 0}),
  },
  'balance-credit': {
    details: BillingDetailsFixture(),
    subscription: SubscriptionFixture({organization, accountBalance: -10000}),
  },
  'balance-zero': {
    details: BillingDetailsFixture(),
    subscription: SubscriptionFixture({organization, accountBalance: 0}),
  },
};

describe('BillingDetailsPanel', () => {
  it.snapshot.each<string>(Object.keys(SCENARIOS))(
    '%s',
    name => {
      const scenario = SCENARIOS[name]!;
      mockUseBillingDetails.mockReturnValue({
        data: scenario.details,
        isLoading: false,
        isError: false,
        error: null,
        refetch: jest.fn(),
      } as unknown as ReturnType<typeof useBillingDetails>);

      return (
        <ThemeProvider theme={lightTheme}>
          <div style={{padding: 8, width: 400}}>
            <BillingDetailsPanel
              organization={organization}
              subscription={scenario.subscription}
            />
          </div>
        </ThemeProvider>
      );
    },
    () => ({tags: {area: 'billing'}})
  );
});
