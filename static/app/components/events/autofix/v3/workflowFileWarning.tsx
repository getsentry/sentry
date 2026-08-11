import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {ExplorerAutofixState} from 'sentry/components/events/autofix/useExplorerAutofix';
import {useRetryStep} from 'sentry/components/events/autofix/v3/retryStepContext';
import {t} from 'sentry/locale';

/**
 * Seer's GitHub App deliberately has no `workflows` permission, so any push
 * whose tree carries a `.github/workflows/` entry is rejected by GitHub — even
 * when the rest of the change is fine. Seer attributes such a failure on the
 * repo's PR state (`pr_creation_error_reason`), and this banner turns that into
 * something the user can act on:
 *
 * - `workflow_patch`: Seer itself edited a workflow file. Seer cannot make that
 *   edit at all, so the user has to either let Seer retry without touching
 *   workflows, or make the workflow change by hand. The offending files are
 *   already visible in the code changes, so the banner doesn't repeat them.
 * - `workflow_drift`: Seer's changes are clean, but the base branch moved past
 *   the commit Seer pinned and the newer commits touched a workflow file.
 *   Retrying re-pins to the current tip, which is usually enough.
 *
 * Retry doesn't re-run the step on its own: the user has to say what Seer
 * should do differently, so it opens the code changes card's retry prompt (or
 * the PR iteration form, whichever that card is showing) and scrolls to it.
 */

function getWorkflowFailureReason(
  runState: ExplorerAutofixState | null | undefined
): 'workflow_patch' | 'workflow_drift' | null {
  for (const state of Object.values(runState?.repo_pr_states ?? {})) {
    if (state.pr_creation_status !== 'error') {
      continue;
    }
    // zLooseEnum widens unknown values to string, so narrow explicitly.
    if (state.pr_creation_error_reason === 'workflow_patch') {
      return 'workflow_patch';
    }
    if (state.pr_creation_error_reason === 'workflow_drift') {
      return 'workflow_drift';
    }
  }
  return null;
}

export function WorkflowFileWarning({runState}: {runState?: ExplorerAutofixState | null}) {
  const retryStep = useRetryStep();
  const reason = getWorkflowFailureReason(runState);

  if (!reason) {
    return null;
  }

  // Deliberately not dismissible: the run is in a failed state, and hiding the
  // banner would leave no explanation for why nothing was pushed.
  return (
    <Stack gap="md" padding="md 2xl 0">
      <Alert
        variant="warning"
        trailingItems={
          <Flex alignSelf="center">
            <Button
              variant="primary"
              size="xs"
              onClick={() => retryStep?.requestRetry('code_changes')}
            >
              {t('Retry')}
            </Button>
          </Flex>
        }
      >
        <Text>
          {reason === 'workflow_patch'
            ? t(
                "Seer couldn't push its changes because they edit GitHub Actions workflow files, which Seer isn't allowed to write. Retry and ask for the fix without them, or make the workflow changes yourself."
              )
            : t(
                "Seer couldn't push its changes: the base branch picked up GitHub Actions workflow file changes after Seer started, and Seer isn't allowed to write those files. Retry to start again from the current branch tip."
              )}
        </Text>
      </Alert>
    </Stack>
  );
}
