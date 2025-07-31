import type {BillingDetails as BillingDetailsType} from 'getsentry/types';
import {AddressType} from 'getsentry/types';

export function BillingDetailsFixture(
  params: Partial<BillingDetailsType> = {}
): BillingDetailsType {
  return {
    billingEmail: 'test@gmail.com',
    companyName: 'Test company',
    addressLine1: '123 Street',
    addressLine2: '',
    city: 'San Francisco',
    region: 'CA',
    countryCode: 'US',
    postalCode: '12345',
    taxNumber: null,
    displayAddress: 'Display Address',
    addressType: AddressType.STRUCTURED,
    ...params,
  };
}
