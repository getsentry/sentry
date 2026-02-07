import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';
import {act, renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {DataCategory} from 'sentry/types/core';

import {useProductBillingAccess} from 'getsentry/hooks/useProductBillingAccess';
import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';

describe('useProductBillingAccess', () => {
  const organization = OrganizationFixture();
  let subscription: Subscription;

  beforeEach(() => {
    subscription = SubscriptionFixture({organization, plan: 'am3_business'});
    SubscriptionStore.set(organization.slug, subscription);
  });
  it('returns true if the org has billing access to the given product', () => {
    const {result} = renderHookWithProviders(useProductBillingAccess, {
      organization,
      initialProps: DataCategory.ERRORS,
    });
    expect(result.current).toBe(true);
  });

  it('returns false if the org does not have billing access to the given product', () => {
    const {result} = renderHookWithProviders(useProductBillingAccess, {
      organization,
      initialProps: DataCategory.TRANSACTIONS,
    });
    expect(result.current).toBe(false);
  });

  it('uses parent add-on context when appropriate', () => {
    const {result: result1} = renderHookWithProviders(useProductBillingAccess, {
      organization,
      initialProps: DataCategory.SEER_USER,
    });
    expect(result1.current).toBe(false);

    act(() => {
      subscription.categories.seerUsers = {
        ...subscription.categories.seerUsers!,
        reserved: 5,
        prepaid: 5,
      };
      SubscriptionStore.set(organization.slug, subscription);
    });

    const {result: result2} = renderHookWithProviders(useProductBillingAccess, {
      organization,
      initialProps: DataCategory.SEER_USER,
    });
    expect(result2.current).toBe(false); // still false because add-on parent is not enabled

    act(() => {
      subscription.addOns!.seer = {
        ...subscription.addOns!.seer!,
        enabled: true,
      };
      SubscriptionStore.set(organization.slug, subscription);
    });

    const {result: result3} = renderHookWithProviders(useProductBillingAccess, {
      organization,
      initialProps: DataCategory.SEER_USER,
    });
    expect(result3.current).toBe(true); // now true because add-on parent is enabled
  });
});
