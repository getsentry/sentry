import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

interface SeerOnboardingCheckResponse {
  hasSupportedScmIntegration: boolean;
  isAutofixEnabled: boolean;
  isCodeReviewEnabled: boolean;
  isSeerConfigured: boolean;
  needsConfigReminder: boolean;
}

interface Props {
  organization: Organization;
  staleTime?: number;
}

export function getSeerOnboardingCheckQueryOptions({organization, staleTime = 0}: Props) {
  return apiOptions.as<SeerOnboardingCheckResponse>()(
    '/organizations/$organizationIdOrSlug/seer/onboarding-check/',
    {
      path: {
        organizationIdOrSlug: organization.slug,
      },
      staleTime,
    }
  );
}
