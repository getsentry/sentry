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
    return;
  }

  const {plan, totalMembers, planDetails} = subscription;
  Sentry.setTag('plan', plan);
  Sentry.setTag('plan.name', planDetails?.name);
  Sentry.setTag('plan.max_members', `${planDetails?.maxMembers}`);
  Sentry.setTag('plan.total_members', `${totalMembers}`);
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
