import * as Sentry from '@sentry/react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import {OrganizationStore} from 'sentry/stores/organizationStore';

import {registerSubscriptionScopeTags} from 'getsentry/registerSubscriptionScopeTags';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';

describe('registerSubscriptionScopeTags', () => {
  const setTag = jest.mocked(Sentry.setTag);
  const organization = OrganizationFixture({slug: 'active-org'});
  const otherOrganization = OrganizationFixture({id: '2', slug: 'other-org'});
  let unregister: (() => void) | undefined;

  beforeEach(() => {
    OrganizationStore.reset();
    SubscriptionStore.init();
    setTag.mockClear();
    unregister = undefined;
  });

  afterEach(() => {
    unregister?.();
  });

  it('tags the active organization subscription when registered', () => {
    OrganizationStore.onUpdate(organization, {replace: true});
    const subscription = SubscriptionFixture({organization, totalMembers: 3});
    SubscriptionStore.set(organization.slug, subscription);

    unregister = registerSubscriptionScopeTags();

    expect(setTag).toHaveBeenCalledWith('plan', subscription.plan);
    expect(setTag).toHaveBeenCalledWith('plan.name', subscription.planDetails.name);
    expect(setTag).toHaveBeenCalledWith(
      'plan.max_members',
      `${subscription.planDetails.maxMembers}`
    );
    expect(setTag).toHaveBeenCalledWith('plan.total_members', '3');
  });

  it('tags the subscription when it loads for the active organization', () => {
    OrganizationStore.onUpdate(organization, {replace: true});
    unregister = registerSubscriptionScopeTags();

    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({organization, plan: 'am3_business'})
    );

    expect(setTag).toHaveBeenCalledWith('plan', 'am3_business');
  });

  it('tags the cached subscription when the active organization changes', () => {
    SubscriptionStore.set(
      otherOrganization.slug,
      SubscriptionFixture({organization: otherOrganization, plan: 'am3_team'})
    );
    OrganizationStore.onUpdate(organization, {replace: true});
    unregister = registerSubscriptionScopeTags();

    OrganizationStore.onUpdate(otherOrganization, {replace: true});

    expect(setTag).toHaveBeenCalledWith('plan', 'am3_team');
  });

  it('does not tag when a subscription loads for an inactive organization', () => {
    OrganizationStore.onUpdate(organization, {replace: true});
    unregister = registerSubscriptionScopeTags();

    SubscriptionStore.set(
      otherOrganization.slug,
      SubscriptionFixture({organization: otherOrganization})
    );

    expect(setTag).not.toHaveBeenCalled();
  });

  it('does not tag when the active organization subscription has no plan', () => {
    OrganizationStore.onUpdate(organization, {replace: true});
    unregister = registerSubscriptionScopeTags();

    SubscriptionStore.set(organization.slug, {hasDismissedTrialEndingNotice: true});

    expect(setTag).not.toHaveBeenCalled();
  });

  it('does not tag when store changes after unregistering', () => {
    OrganizationStore.onUpdate(organization, {replace: true});
    registerSubscriptionScopeTags()();

    SubscriptionStore.set(organization.slug, SubscriptionFixture({organization}));

    expect(setTag).not.toHaveBeenCalled();
  });
});
