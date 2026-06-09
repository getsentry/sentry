import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';

type AutofixAutomationTuning =
  | 'off'
  | 'super_low' // deprecated
  | 'low' // deprecated
  | 'medium'
  | 'high' // deprecated
  | 'always' // deprecated
  | null; // deprecated

type AutofixAutomationSettings = {
  autofixAutomationTuning: AutofixAutomationTuning;
  automatedRunStoppingPoint: ProjectSeerPreferences['automated_run_stopping_point'];
  automationHandoff: ProjectSeerPreferences['automation_handoff'];
  projectId: string | number; // Ideally this is a string, but in reality it can be a number.
  reposCount: number;
};

export function bulkAutofixAutomationSettingsInfiniteOptions({
  organization,
}: {
  organization: Organization;
}) {
  return apiOptions.asInfinite<AutofixAutomationSettings[]>()(
    '/organizations/$organizationIdOrSlug/autofix/automation-settings/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {per_page: 100},
      staleTime: 0,
    }
  );
}
