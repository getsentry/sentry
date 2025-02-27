import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import type {Organization as TOrganization} from 'sentry/types/organization';

import type {Invoice as TInvoice} from 'getsentry/types';

export function InvoiceFixture(
  params: Partial<TInvoice> = {},
  organization?: TOrganization
): TInvoice {
  const mockOrg = OrganizationFixture();
  return {
    amount: 0,
    amountBilled: 0,
    amountRefunded: 0,
    channel: 'self-serve',
    chargeAttempts: 1,
    creditApplied: null,
    dateCreated: '2018-06-25T22:33:38.042Z',
    id: '1a2c3b4d5e6f',
    isClosed: true,
    isPaid: true,
    isRefunded: false,
    nextChargeAttempt: null,
    sender: {
      name: 'Sentry',
      address: ['The internet'],
    },
    receipt: {
      url: `https://sentry.io/organizations/${mockOrg.slug}/payments/1a2b/pdf/3c4d/`,
    },
    stripeInvoiceID: null,
    type: 'credit card',
    customer: SubscriptionFixture({organization: organization ?? mockOrg}),
    items: [],
    charges: [],
    addressLine1: null,
    addressLine2: null,
    city: null,
    countryCode: null,
    postalCode: null,
    region: null,
    displayAddress: null,
    sentryTaxIds: null,
    taxNumber: null,
    defaultTaxName: null,
    effectiveAt: null,
    isReverseCharge: false,
    periodEnd: null,
    periodStart: null,
    ...params,
  };
}
