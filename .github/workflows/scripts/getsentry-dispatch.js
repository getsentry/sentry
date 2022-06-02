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
    pathFilterName: 'backend_dependencies',
  },
];

module.exports = {
  dispatch: async ({github, context, fileChanges}) => {
    const shouldSkip = {
      frontend: fileChanges.frontend !== 'true',
      backend_dependencies: fileChanges.backend_dependencies !== 'true',
    };

    DISPATCHES.forEach(({workflow, pathFilterName}) => {
      github.actions.createWorkflowDispatch({
        owner: 'getsentry',
        repo: 'getsentry',
        workflow_id: workflow,
        ref: 'master',
        inputs: {
          pull_request_number: `${context.payload.pull_request.number}`, // needs to be string
          skip: `${shouldSkip[pathFilterName]}`, // even though this is a boolean, it must be cast to a string
          'sentry-sha': context.payload.pull_request.head.sha,
        },
      });
    });
  },
};
