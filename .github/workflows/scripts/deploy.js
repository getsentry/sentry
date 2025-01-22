/**
 * GHA Workflow helpers for deploys
 *
 */

module.exports = {
  /**
   * Checks what files were changed in a commit and adds a GH check
   * corresponding with changes. This can be used by our deploy system to
   * determine what Freight deploy we can use.
   */
  updateChangeType: async ({github, context, fileChanges}) => {
    // Note that `fileChanges` bools and ints will get cast to strings
    const {frontend_all: frontend, backend_all: backend} = fileChanges;
    const frontendOnly = frontend === 'true' && backend === 'false';
    const backendOnly = backend === 'true' && frontend === 'false';

    const name = frontendOnly
      ? 'only frontend changes'
      : backendOnly
        ? 'only backend changes'
        : 'fullstack changes';

    if (!name) {
      return null;
    }

    const result = await github.rest.checks.create({
      owner: context.repo.owner,
      repo: context.repo.repo,
      name,
      head_sha: context.sha,
      status: 'completed',
      conclusion: 'success',
    });

    return result;
  },
};
