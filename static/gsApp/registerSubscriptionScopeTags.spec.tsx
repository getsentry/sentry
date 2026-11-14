import * as Sentry from '@sentry/react';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {SubscriptionFixture} from 'getsentry-test/fixtures/subscription';

import {OrganizationStore} from 'sentry/stores/organizationStore';

import {registerSubscriptionScopeTags} from 'getsentry/registerSubscriptionScopeTags';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';

describe('registerSubscriptionScopeTags', () => {
  const setTags = jest.mocked(Sentry.setTags);
  const clearedTags = {
    plan: undefined,
    'plan.name': undefined,
    'plan.max_members': undefined,
    'plan.total_members': undefined,
  };
  const organization = OrganizationFixture({slug: 'active-org'});
  const otherOrganization = OrganizationFixture({id: '2', slug: 'other-org'});
  let unregister: (() => void) | undefined;

  beforeEach(() => {
    OrganizationStore.reset();
    SubscriptionStore.init();
    unregister = undefined;
  });

  afterEach(() => {
    unregister?.();
  });

  it('tags the active organization subscription when registered', () => {
    OrganizationStore.onUpdate(organization, {replace: true});
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({organization, plan: 'am1_f', totalMembers: 3})
    );

    unregister = registerSubscriptionScopeTags();

    expect(setTags).toHaveBeenCalledWith({
      plan: 'am1_f',
      'plan.name': 'Developer',
      'plan.max_members': '1',
      'plan.total_members': '3',
    });
  });

  it('tags the subscription when it loads for the active organization', () => {
    OrganizationStore.onUpdate(organization, {replace: true});
    unregister = registerSubscriptionScopeTags();

    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({organization, plan: 'am3_business'})
    );

    expect(setTags).toHaveBeenLastCalledWith(
      expect.objectContaining({plan: 'am3_business'})
    );
  });

  it('tags the cached subscription when the active organization changes', () => {
    SubscriptionStore.set(
      otherOrganization.slug,
      SubscriptionFixture({organization: otherOrganization, plan: 'am3_team'})
    );
    OrganizationStore.onUpdate(organization, {replace: true});
    unregister = registerSubscriptionScopeTags();

    OrganizationStore.onUpdate(otherOrganization, {replace: true});

    expect(setTags).toHaveBeenLastCalledWith(expect.objectContaining({plan: 'am3_team'}));
  });

  it('does not tag when a subscription loads for an inactive organization', () => {
    OrganizationStore.onUpdate(organization, {replace: true});
    unregister = registerSubscriptionScopeTags();

    SubscriptionStore.set(
      otherOrganization.slug,
      SubscriptionFixture({organization: otherOrganization, plan: 'am3_team'})
    );

    expect(setTags).not.toHaveBeenCalledWith(expect.objectContaining({plan: 'am3_team'}));
  });

  it('clears tags when the active organization changes to one without a subscription', () => {
    SubscriptionStore.set(
      organization.slug,
      SubscriptionFixture({organization, plan: 'am3_team'})
    );
    OrganizationStore.onUpdate(organization, {replace: true});
    unregister = registerSubscriptionScopeTags();

    OrganizationStore.onUpdate(otherOrganization, {replace: true});

    expect(setTags).toHaveBeenLastCalledWith(clearedTags);
  });

  it('clears tags when the active organization subscription has no plan', () => {
    OrganizationStore.onUpdate(organization, {replace: true});
    unregister = registerSubscriptionScopeTags();

    SubscriptionStore.set(organization.slug, {hasDismissedTrialEndingNotice: true});

    expect(setTags).toHaveBeenLastCalledWith(clearedTags);
  });

  it('does not tag when store changes after unregistering', () => {
    OrganizationStore.onUpdate(organization, {replace: true});
    registerSubscriptionScopeTags()();
    setTags.mockClear();

    SubscriptionStore.set(organization.slug, SubscriptionFixture({organization}));
    SubscriptionStore.set(
      otherOrganization.slug,
      SubscriptionFixture({organization: otherOrganization})
    );
    OrganizationStore.onUpdate(otherOrganization, {replace: true});

    expect(setTags).not.toHaveBeenCalled();
  });
});
