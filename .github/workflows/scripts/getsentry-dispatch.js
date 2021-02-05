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
      }
    ];

    console.log(fileChanges, context);

    const shouldSkip = {
      frontend: fileChanges.frontend != 'true',
      backend_dependencies: fileChanges.backend_dependencies != 'true',
    };

    DISPATCHES.forEach(({workflow, pathFilterName}) => {
      github.actions.createWorkflowDispatch({
        owner: 'getsentry',
        repo: 'getsentry',
        workflow_id: workflow,
        ref: 'build/ci/add-backend-dependencies-test', // TODO: this needs to be 'master'
        inputs: {
          skip: shouldSkip[pathFilterName],
          'sentry-sha': '${{ github.event.pull_request.head.sha }}',
        }
      })
    });
  }
}
