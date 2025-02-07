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
    workflow: 'js-build-and-lint.yml',
    pathFilterName: 'frontend_all',
  },
  {
    workflow: 'backend.yml',
    pathFilterName: 'backend_all',
  },
];

module.exports = {
  dispatch: async ({github, context, core, fileChanges, mergeCommitSha}) => {
    core.startGroup('Dispatching request to getsentry.');

    await Promise.all(
      DISPATCHES.map(({workflow, pathFilterName}) => {
        const inputs = {
          pull_request_number: `${context.payload.pull_request.number}`, // needs to be string
          skip: `${fileChanges[pathFilterName] !== 'true'}`, // even though this is a boolean, it must be cast to a string

          // sentrySHA is the sha getsentry should run against.
          'sentry-sha': mergeCommitSha,
          // prSHA is the sha actions should post commit statuses too.
          'sentry-pr-sha': context.payload.pull_request.head.sha,
        };

        core.info(
          `Sending dispatch for '${workflow}':\n${JSON.stringify(inputs, null, 2)}`
        );

        return github.rest.actions.createWorkflowDispatch({
          owner: 'getsentry',
          repo: 'getsentry',
          workflow_id: workflow,
          ref: 'master',
          inputs,
        });
      })
    );

    core.endGroup();
  },
};
