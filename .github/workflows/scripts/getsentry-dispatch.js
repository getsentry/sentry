/**
 * List of workflows to dispatch to `getsentry`
 *
 * `pathFilterName` refers to the path filters in `.github/file-filters.yml` (`getsentry/paths-filter` action)
 *
 * TODO(billy): Refactor workflow files to be an enum so that we can integration test them. Otherwise if they are
 *              deleted/renamed in `getsentry`, this will fail
 */
const DISPATCHES = [
  {
    workflow: 'backend.yml',
    pathFilterName: 'backend_all',
  },
  {
    workflow: 'acceptance.yml',
    pathFilterName: 'gsapp',
  },
];

// Merge groups only need the check that the merge queue requires.
const MERGE_GROUP_WORKFLOW = 'backend.yml';

const RETRY_DELAYS_MS = [5000, 15000, 30000, 60000];
const MAX_WORKFLOW_DISPATCH_INPUTS_LENGTH = 65_535;

/**
 * Returns the pull request number, the SHA for getsentry to test, and the SHA to
 * report the check on.
 *
 * For a merge group, this runs from a workflow_run event. The group's head
 * commit is both what lands and what the merge queue waits for checks on. Its
 * branch names the last pull request in the group:
 * gh-readonly-queue/<base branch>/pr-<number>-<base sha>
 */
function getSentryTarget({context, mergeCommitSha}) {
  const workflowRun = context.payload.workflow_run;
  if (workflowRun) {
    return {
      pullRequestNumber:
        workflowRun.head_branch.match(/\/pr-(\d+)-[0-9a-f]{40}$/)?.[1] ?? '',
      sentrySha: workflowRun.head_sha,
      reportSha: workflowRun.head_sha,
    };
  }
  const pullRequest = context.payload.pull_request;
  return {
    pullRequestNumber: `${pullRequest.number}`,
    sentrySha: mergeCommitSha,
    reportSha: pullRequest.head.sha,
  };
}

async function dispatchWithRetry({github, core, workflow, inputs}) {
  const maxAttempts = RETRY_DELAYS_MS.length + 1;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await github.rest.actions.createWorkflowDispatch({
        owner: 'getsentry',
        repo: 'getsentry',
        workflow_id: workflow,
        ref: 'master',
        inputs,
      });
      return;
    } catch (err) {
      if (attempt === maxAttempts) {
        throw err;
      }
      const delay = RETRY_DELAYS_MS[attempt - 1];
      core.warning(
        `Dispatch for '${workflow}' failed (attempt ${attempt}/${maxAttempts}): ${err.message}. Retrying in ${delay / 1000}s...`
      );
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

export async function dispatch({
  github,
  context,
  core,
  fileChanges,
  mergeCommitSha,
  sentryChangedFiles,
  sentryPreviousFilenames,
  targetWorkflow,
}) {
  core.startGroup('Dispatching request to getsentry.');

  const {pullRequestNumber, sentrySha, reportSha} = getSentryTarget({
    context,
    mergeCommitSha,
  });

  const dispatches =
    targetWorkflow !== undefined
      ? [
          {
            workflow: targetWorkflow,
            pathFilterName:
              DISPATCHES.find(d => d.workflow === targetWorkflow)?.pathFilterName ??
              'backend_all',
          },
        ]
      : context.payload.workflow_run
        ? DISPATCHES.filter(d => d.workflow === MERGE_GROUP_WORKFLOW)
        : DISPATCHES;

  await Promise.all(
    dispatches.map(({workflow, pathFilterName}) => {
      const inputs = {
        pull_request_number: pullRequestNumber, // needs to be string
        skip: `${fileChanges[pathFilterName] !== 'true'}`, // even though this is a boolean, it must be cast to a string

        // sentrySHA is the sha getsentry should run against.
        'sentry-sha': sentrySha,
        // prSHA is the sha actions should post commit statuses too.
        'sentry-pr-sha': reportSha,

        // Changed files for selective testing. Empty string means full suite.
        'sentry-changed-files': sentryChangedFiles || '',
        'sentry-previous-filenames': sentryPreviousFilenames || '',
      };

      if (JSON.stringify(inputs).length > MAX_WORKFLOW_DISPATCH_INPUTS_LENGTH) {
        core.warning(
          `Inputs for '${workflow}' exceed GitHub's ` +
            `${MAX_WORKFLOW_DISPATCH_INPUTS_LENGTH}-character limit. ` +
            'Clearing changed-file lists so getsentry runs the full suite.'
        );
        inputs['sentry-changed-files'] = '';
        inputs['sentry-previous-filenames'] = '';
      }

      core.info(
        `Sending dispatch for '${workflow}':\n${JSON.stringify(inputs, null, 2)}`
      );

      return dispatchWithRetry({github, core, workflow, inputs});
    })
  );

  core.endGroup();
}
