import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import type {Partner, Subscription} from 'getsentry/types';

import {isDisabledByPartner} from './partnerships';

describe('isDisabledByPartner', () => {
  const organization = OrganizationFixture();

  it('returns false when partner is null', () => {
    const subscription = SubscriptionFixture({
      organization,
      partner: null,
    });
    expect(isDisabledByPartner(subscription)).toBe(false);
  });

  it('returns false when partner is undefined', () => {
    const subscription = SubscriptionFixture({
      organization,
      partner: undefined,
    }) as Subscription;
    expect(isDisabledByPartner(subscription)).toBe(false);
  });

  it('returns false when partner is inactive', () => {
    const inactivePartner: Partner = {
      isActive: false,
      name: 'TestPartner',
      partnership: {
        supportNote: 'Some support note',
      },
    } as Partner;

    const subscription = SubscriptionFixture({
      organization,
      partner: inactivePartner,
    });
    expect(isDisabledByPartner(subscription)).toBe(false);
  });

  it('returns false when partner has no support note', () => {
    const partnerNoNote: Partner = {
      isActive: true,
      name: 'TestPartner',
      partnership: {
        supportNote: null,
      },
    } as Partner;

    const subscription = SubscriptionFixture({
      organization,
      partner: partnerNoNote,
    });
    expect(isDisabledByPartner(subscription)).toBe(false);
  });

  it('returns true when partner is active and has support note', () => {
    const activePartner: Partner = {
      isActive: true,
      name: 'TestPartner',
      partnership: {
        supportNote: 'Contact partner for billing',
      },
    } as Partner;

    const subscription = SubscriptionFixture({
      organization,
      partner: activePartner,
    });
    expect(isDisabledByPartner(subscription)).toBe(true);
  });
});
