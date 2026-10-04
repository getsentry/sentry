import {useMutation, useQueryClient} from '@tanstack/react-query';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {explorerAutofixApiOptions} from 'sentry/components/events/autofix/useExplorerAutofix';
import {getAutofixRunExists} from 'sentry/components/events/autofix/utils';
import {t} from 'sentry/locale';
import type {AutofixBlocker, Group, LastCompletedAutofixStep} from 'sentry/types/group';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {areAiFeaturesAllowed} from 'sentry/utils/seer/areAiFeaturesAllowed';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeSeerLocation} from 'sentry/views/issueDetails/autofix/utils';
import {groupQueryKey} from 'sentry/views/issueDetails/useGroup';

type AutofixState = {nextStep: string; status: string | null};

// A blocker means Autofix is waiting on the user, which outranks the last step.
const BLOCKED_STATES: Record<Exclude<AutofixBlocker, 'none'>, AutofixState> = {
  approve_root_cause: {status: t('Root cause ready'), nextStep: t('Review root cause')},
  approve_plan: {status: t('Plan ready'), nextStep: t('Review plan')},
  approve_code_changes: {status: t('Code changes ready'), nextStep: t('Review changes')},
  merge_pr: {status: null, nextStep: t('View PR')},
};

const IN_PROGRESS_STATE: AutofixState = {
  status: t('In progress'),
  nextStep: t('Open Seer'),
};

const STEP_STATES: Record<LastCompletedAutofixStep, AutofixState> = {
  none: {status: null, nextStep: t('Start Autofix')},
  root_cause: {status: t('Root cause found'), nextStep: t('Make a plan')},
  solution: {status: t('Plan written'), nextStep: t('Write code fix')},
  code_changes: {status: t('Code changes written'), nextStep: t('Draft PR')},
  pr_created: {status: null, nextStep: t('View PR')},
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
  return getAutofixRunExists(group) ? IN_PROGRESS_STATE : STEP_STATES.none;
}

/**
 * Starts an Autofix run that goes all the way to an open PR, rather than
 * stopping after the root cause for the user to approve each step.
 */
export function startFullAutofix(orgSlug: string, groupId: string) {
  return fetchMutation({
    method: 'POST',
    url: getApiUrl('/organizations/$organizationIdOrSlug/issues/$issueId/autofix/', {
      path: {organizationIdOrSlug: orgSlug, issueId: groupId},
    }),
    options: {query: {mode: 'explorer'}},
    data: {step: 'root_cause', stopping_point: 'open_pr', referrer: 'api.web'},
  });
}

function useStartFullAutofix(group: Group) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => startFullAutofix(organization.slug, group.id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: explorerAutofixApiOptions(organization.slug, group.id).queryKey,
      });
      queryClient.invalidateQueries({
        queryKey: groupQueryKey({organizationSlug: organization.slug, groupId: group.id}),
      });
    },
    onError: () => addErrorMessage(t('Unable to start Autofix')),
  });
}

/**
 * Autofix status for an issue row. An issue without a run can start one that
 * runs every step; otherwise the button links to Seer for the next step.
 */
export function GroupAutofixStatus({group}: {group: Group}) {
  const organization = useOrganization();
  const location = useLocation();
  const startAutofix = useStartFullAutofix(group);

  if (!areAiFeaturesAllowed(organization)) {
    return null;
  }

  const state = getAutofixState(group);
  const isUnstarted = state === STEP_STATES.none && !startAutofix.isSuccess;
  const {status, nextStep} = startAutofix.isSuccess ? IN_PROGRESS_STATE : state;

  return (
    <Stack gap="xs" align="start">
      {status ? (
        <Text size="sm" variant="muted">
          {status}
        </Text>
      ) : null}
      {isUnstarted ? (
        <Button
          size="xs"
          busy={startAutofix.isPending}
          disabled={startAutofix.isPending}
          onClick={() => startAutofix.mutate()}
        >
          {nextStep}
        </Button>
      ) : (
        <LinkButton
          size="xs"
          to={makeSeerLocation({organization, groupId: group.id, query: location.query})}
        >
          {nextStep}
        </LinkButton>
      )}
    </Stack>
  );
}
