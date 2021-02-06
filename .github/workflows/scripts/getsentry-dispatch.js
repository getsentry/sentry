/* eslint-env node */

module.exports = {
  dispatch: async ({github, context, fileChanges}) => {
    const DISPATCHES = [
      {
        workflow: 'js-build-and-lint.yml',
        pathFilterName: 'frontend',
      },
      {
        workflow: 'backend-test.yml',
        pathFilterName: 'backend_dependencies',
      },
    ];

    const shouldSkip = {
      frontend: fileChanges.frontend !== 'true',
      backend_dependencies: fileChanges.backend_dependencies !== 'true',
    };

    DISPATCHES.forEach(({workflow, pathFilterName}) => {
      github.actions.createWorkflowDispatch({
        owner: 'getsentry',
        repo: 'getsentry',
        workflow_id: workflow,
        ref: 'build/ci/add-backend-dependencies-test', // TODO: this needs to be 'master'
        inputs: {
          pull_request_number: context.payload.pull_request.number,
          skip: `${shouldSkip[pathFilterName]}`, // even though this is a boolean, it must be cast to a string
          'sentry-sha': context.payload.pull_request.head.sha,
        },
      });
    });
  },
};
