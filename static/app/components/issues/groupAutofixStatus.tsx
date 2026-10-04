import {LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {getAutofixRunExists} from 'sentry/components/events/autofix/utils';
import {t} from 'sentry/locale';
import type {AutofixBlocker, Group, LastCompletedAutofixStep} from 'sentry/types/group';
import {areAiFeaturesAllowed} from 'sentry/utils/seer/areAiFeaturesAllowed';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeSeerLocation} from 'sentry/views/issueDetails/autofix/utils';

type AutofixState = {nextStep: string; status: string};

// A blocker means Autofix is waiting on the user, which outranks the last step.
const BLOCKED_STATES: Record<Exclude<AutofixBlocker, 'none'>, AutofixState> = {
  approve_root_cause: {status: t('Root cause ready'), nextStep: t('Review root cause')},
  approve_plan: {status: t('Plan ready'), nextStep: t('Review plan')},
  approve_code_changes: {status: t('Code changes ready'), nextStep: t('Review changes')},
  merge_pr: {status: t('PR open'), nextStep: t('Merge PR')},
};

const STEP_STATES: Record<LastCompletedAutofixStep, AutofixState> = {
  none: {status: t('Not started'), nextStep: t('Find root cause')},
  root_cause: {status: t('Root cause found'), nextStep: t('Make a plan')},
  solution: {status: t('Plan written'), nextStep: t('Write code fix')},
  code_changes: {status: t('Code changes written'), nextStep: t('Draft PR')},
  pr_created: {status: t('PR created'), nextStep: t('View PR')},
  pr_iteration: {status: t('Iterating on PR'), nextStep: t('View PR')},
};

export function getAutofixState(group: Group): AutofixState {
  const {blocker, lastCompletedAutofixStep} = group.derivedData ?? {};
  if (blocker && blocker !== 'none') {
    return BLOCKED_STATES[blocker];
  }
  if (lastCompletedAutofixStep) {
    return STEP_STATES[lastCompletedAutofixStep];
  }
  // Without derived data (it's only returned with expand=derivedData), the
  // most the group says is whether a run happened recently.
  return getAutofixRunExists(group)
    ? {status: t('In progress'), nextStep: t('Open Seer')}
    : STEP_STATES.none;
}

/**
 * Autofix status for an issue row, with a link to Seer where the next step
 * can be run.
 */
export function GroupAutofixStatus({group}: {group: Group}) {
  const organization = useOrganization();
  const location = useLocation();

  if (!areAiFeaturesAllowed(organization)) {
    return null;
  }

  const {status, nextStep} = getAutofixState(group);
  return (
    <Stack gap="xs" align="start">
      <Text size="sm" variant="muted">
        {status}
      </Text>
      <LinkButton
        size="xs"
        to={makeSeerLocation({organization, groupId: group.id, query: location.query})}
      >
        {nextStep}
      </LinkButton>
    </Stack>
  );
}
