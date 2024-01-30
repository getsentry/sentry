/* eslint-env node */

const CODE_OWNER_MIGRATIONS = 'getsentry/owners-migrations';

module.exports = {
  check: async ({github, context, core}) => {
    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const pr = context.issue.number;

    // Get all reviews for this PR
    const {data: reviews} = await github.pulls.listReviews({
      owner,
      repo,
      pull_number: pr,
    });

    // Check if @getsentry/owners-migrations approved this PR
    const approved = reviews.some(
      review => review.user.login === CODE_OWNER_MIGRATIONS && review.state === 'APPROVED'
    );

    if (!approved) {
      core.setFailed('Migration not approved by @getsentry/owners-migrations');
    }
  },
};
