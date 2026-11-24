import {useEffect, useState} from 'react';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import type {Organization} from 'sentry/types/organization';
import {useOrganization} from 'sentry/utils/useOrganization';

import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';

interface SubscriptionLoadingFallbackProps {
  organization?: Organization;
}

export function SubscriptionLoadingFallback({
  organization: organizationOverride,
}: SubscriptionLoadingFallbackProps) {
  const contextOrganization = useOrganization({allowNull: true});
  const slug = (organizationOverride ?? contextOrganization)?.slug;
  const [attempt, setAttempt] = useState(0);
  const [failedLoad, setFailedLoad] = useState<{attempt: number; slug: string}>();

  useEffect(() => {
    if (!slug || SubscriptionStore.getState()[slug]) {
      return;
    }

    let active = true;
    SubscriptionStore.loadData(slug).then(() => {
      if (active && SubscriptionStore.errors[slug] !== undefined) {
        setFailedLoad({attempt, slug});
      }
    });

    return () => {
      active = false;
    };
  }, [attempt, slug]);

  if (failedLoad?.attempt === attempt && failedLoad.slug === slug) {
    return <LoadingError onRetry={() => setAttempt(current => current + 1)} />;
  }

  return <LoadingIndicator />;
}
