import {useMemo} from 'react';

import {AutofixStoppingPoint} from 'sentry/components/events/autofix/types';
import type {ProjectSeerPreferences} from 'sentry/components/events/autofix/types';
import {t} from 'sentry/locale';
import type {
  InternalAutomationTuning,
  SeerAutofixStoppingPoint,
  UserFacingStoppingPoint,
} from 'sentry/utils/seer/types';
import {useOrganization} from 'sentry/utils/useOrganization';

// @deprecated: Call `useStoppingPointSelectOptions()` instead
export const PROJECT_STOPPING_POINT_OPTIONS: Array<{
  label: string;
  value: UserFacingStoppingPoint;
}> = [
  {value: 'off', label: t('No Automation')},
  {value: 'root_cause', label: t('Stop after Root Cause')},
  {value: 'plan', label: t('Stop after Plan')},
  {value: 'create_pr', label: t('Stop after PR drafted')},
];

/**
 * Combine solution & code_changes into code_changes for seat-based seer.
 * Fewer steps is easier for users to work with.
 */
export function coaleseStoppingPoint(
  stoppingPoint: SeerAutofixStoppingPoint,
  automationTuning: InternalAutomationTuning
) {
  if (automationTuning === 'off') {
    return 'off';
  }
  return {
    off: 'off' as const,
    root_cause: 'root_cause' as const,
    solution: 'code_changes' as const,
    code_changes: 'code_changes' as const,
    open_pr: 'open_pr' as const,
  }[stoppingPoint];
}

/**
 * Return a list of user-facing stopping point options for a select component.
 *
 * Aligned with `SEAT_BASED_STOPPING_POINTS`
 * https://github.com/getsentry/sentry/blob/master/src/sentry/seer/autofix/utils.py#L71-L81
 */
export function useStoppingPointSelectOptions() {
  const organization = useOrganization();
  return useMemo<
    Array<{
      label: string;
      value: SeerAutofixStoppingPoint;
    }>
  >(() => {
    if (organization.features.includes('seer-added')) {
      return [
        {value: 'off', label: t('No Automation')},
        {value: 'root_cause', label: t('Stop after Root Cause')},
        {value: 'solution', label: t('Stop after Plan')},
        {value: 'code_changes', label: t('Stop after Code Changes')},
        {value: 'open_pr', label: t('Stop after PR drafted')},
      ];
    }
    return [
      {value: 'off', label: t('No Automation')},
      {value: 'root_cause', label: t('Stop after Root Cause')},
      {value: 'code_changes', label: t('Stop after Plan')},
      {value: 'open_pr', label: t('Stop after PR drafted')},
    ];
  }, [organization.features]);
}

export function useOrgDefaultStoppingPoint(): UserFacingStoppingPoint {
  const organization = useOrganization();

  switch (organization.defaultAutomatedRunStoppingPoint) {
    case AutofixStoppingPoint.ROOT_CAUSE:
      return 'root_cause';
    case AutofixStoppingPoint.SOLUTION:
      return 'plan';
    case AutofixStoppingPoint.CODE_CHANGES:
      return 'create_pr';
    case AutofixStoppingPoint.OPEN_PR:
      return 'create_pr';
  }
}

export function getTuningFromStoppingPoint(
  stoppingPoint: UserFacingStoppingPoint
): 'off' | 'medium' {
  return stoppingPoint === 'off' ? ('off' as const) : ('medium' as const);
}

/**
 * Returns mutation options for updating the stopping point on a project.
 *
 * The 'create_pr' value is handled differently per agent type:
 *   - Seer: sets automated_run_stopping_point to 'open_pr'
 *   - External: sets automation_handoff.auto_create_pr = true, stopping point stays 'code_changes'
 *
 * Setting 'off' only writes autofixAutomationTuning and intentionally leaves
 * automated_run_stopping_point unchanged, so re-enabling restores the prior state.
 */
export function resolveStoppingPoint(
  stoppingPoint: UserFacingStoppingPoint,
  handoff: ProjectSeerPreferences['automation_handoff']
): {
  automationHandoff: ProjectSeerPreferences['automation_handoff'];
  stoppingPointValue: ProjectSeerPreferences['automated_run_stopping_point'];
} {
  switch (stoppingPoint) {
    case 'create_pr':
      return {
        stoppingPointValue: 'open_pr',
        automationHandoff: handoff ? {...handoff, auto_create_pr: true} : undefined,
      };
    case 'plan':
      return {
        stoppingPointValue: 'code_changes',
        automationHandoff: handoff ? {...handoff, auto_create_pr: false} : undefined,
      };
    case 'root_cause':
      return {
        stoppingPointValue: 'root_cause',
        automationHandoff: handoff ? {...handoff, auto_create_pr: false} : undefined,
      };
    default:
      return {
        stoppingPointValue: undefined,
        automationHandoff: handoff ? {...handoff, auto_create_pr: false} : undefined,
      };
  }
}
