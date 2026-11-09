import * as Sentry from '@sentry/react';

import {OrganizationStore} from 'sentry/stores/organizationStore';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';

function setSubscriptionScopeTags() {
  const {organization} = OrganizationStore.getState();
  if (!organization) {
    return;
  }

  const subscription = SubscriptionStore.getState()[organization.slug];
  if (subscription?.plan === undefined) {
    Sentry.setTags({
      plan: undefined,
      'plan.name': undefined,
      'plan.max_members': undefined,
      'plan.total_members': undefined,
    });
    return;
  }

  const {plan, totalMembers, planDetails} = subscription;
  Sentry.setTags({
    plan,
    'plan.name': planDetails?.name,
    'plan.max_members': `${planDetails?.maxMembers}`,
    'plan.total_members': `${totalMembers}`,
  });
}

export function registerSubscriptionScopeTags() {
  setSubscriptionScopeTags();

  const unsubscribeSubscription = SubscriptionStore.listen(
    setSubscriptionScopeTags,
    undefined
  );
  const unsubscribeOrganization = OrganizationStore.listen(
    setSubscriptionScopeTags,
    undefined
  );

  return () => {
    unsubscribeSubscription();
    unsubscribeOrganization();
  };
}
