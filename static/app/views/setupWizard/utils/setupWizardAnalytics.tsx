import {useCallback, useEffect, useMemo} from 'react';

import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';

function useSetupWizardAnalyticsParams(organizations: Organization[]) {
  const urlParams = new URLSearchParams(location.search);
  const projectPlatform = urlParams.get('project_platform') ?? undefined;

  // if we have exactly one organization, we can use it for analytics
  // otherwise we don't know which org the user is in
  return useMemo(
    () => ({
      organization: organizations.length === 1 ? organizations[0]!.slug : null,
      project_platform: projectPlatform,
    }),
    [organizations, projectPlatform]
  );
}

const EMPTY_ARRAY = [];

export function useSetupWizardViewedAnalytics(organizations: Organization[] | undefined) {
  const analyticsParams = useSetupWizardAnalyticsParams(organizations ?? EMPTY_ARRAY);

  useEffect(() => {
    if (!organizations?.length) {
      return;
    }
    trackAnalytics('setup_wizard_viewed', analyticsParams);
  }, [analyticsParams, organizations?.length]);
}

export function useSetupWizardCompletedAnalytics(organizations: Organization[]) {
  const analyticsParams = useSetupWizardAnalyticsParams(organizations);

  return useCallback(() => {
    trackAnalytics('setup_wizard_completed', analyticsParams);
  }, [analyticsParams]);
}
