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

const RETRY_DELAYS_MS = [5000, 15000, 30000, 60000];

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
      : DISPATCHES;

  await Promise.all(
    dispatches.map(({workflow, pathFilterName}) => {
      const inputs = {
        pull_request_number: `${context.payload.pull_request.number}`, // needs to be string
        skip: `${fileChanges[pathFilterName] !== 'true'}`, // even though this is a boolean, it must be cast to a string

        // sentrySHA is the sha getsentry should run against.
        'sentry-sha': mergeCommitSha,
        // prSHA is the sha actions should post commit statuses too.
        'sentry-pr-sha': context.payload.pull_request.head.sha,

        // Changed files for selective testing. Empty string means full suite.
        'sentry-changed-files': sentryChangedFiles || '',
        'sentry-previous-filenames': sentryPreviousFilenames || '',
      };

      core.info(
        `Sending dispatch for '${workflow}':\n${JSON.stringify(inputs, null, 2)}`
      );

      return dispatchWithRetry({github, core, workflow, inputs});
    })
  );

  core.endGroup();
}
