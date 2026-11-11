import {useCallback, useEffect, useMemo} from 'react';
import {parseAsString, useQueryState} from 'nuqs';

import type {OrganizationSummary} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';

function useSetupWizardAnalyticsParams(organizations: OrganizationSummary[]) {
  const [projectPlatform] = useQueryState('project_platform', parseAsString);

  // if we have exactly one organization, we can use it for analytics
  // otherwise we don't know which org the user is in
  return useMemo(
    () => ({
      organization: organizations.length === 1 ? organizations[0]!.slug : null,
      project_platform: projectPlatform ?? undefined,
    }),
    [organizations, projectPlatform]
  );
}

const EMPTY_ARRAY: any = [];

export function useSetupWizardViewedAnalytics(
  organizations: OrganizationSummary[] | undefined
) {
  const analyticsParams = useSetupWizardAnalyticsParams(organizations ?? EMPTY_ARRAY);

  useEffect(() => {
    if (!organizations?.length) {
      return;
    }
    trackAnalytics('setup_wizard_viewed', analyticsParams);
  }, [analyticsParams, organizations?.length]);
}

export function useSetupWizardCompletedAnalytics(organizations: OrganizationSummary[]) {
  const analyticsParams = useSetupWizardAnalyticsParams(organizations);

  return useCallback(() => {
    trackAnalytics('setup_wizard_completed', analyticsParams);
  }, [analyticsParams]);
}
