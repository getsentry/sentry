/* eslint-env node */

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
    pathFilterName: 'frontend',
  },
  {
    workflow: 'backend.yml',
    pathFilterName: 'backend_src',
  },
];

module.exports = {
  dispatch: async ({github, context, fileChanges}) => {
    const shouldSkip = {
      frontend: fileChanges.frontend_all !== 'true',
      backend_dependencies: fileChanges.backend_dependencies !== 'true',
    };

    const pr = context.payload.pull_request;
    // sentrySHA is the sha getsentry should run against.
    const sentrySHA = pr.merge_commit_sha;
    // prSHA is the sha actions should post commit statuses too.
    const prSHA = pr.head.sha;

    await Promise.all(
      DISPATCHES.map(({workflow, pathFilterName}) => {
        return github.rest.actions.createWorkflowDispatch({
          owner: 'getsentry',
          repo: 'getsentry',
          workflow_id: workflow,
          ref: 'master',
          inputs: {
            pull_request_number: `${context.payload.pull_request.number}`, // needs to be string
            skip: `${shouldSkip[pathFilterName]}`, // even though this is a boolean, it must be cast to a string
            'sentry-sha': sentrySHA,
            'sentry-pr-sha': prSHA,
          },
        });
      })
    );
  },
};
