/* eslint-env node */

const CODE_OWNER_MIGRATIONS_TEAM_NAME = 'owners-migrations';

module.exports = {
  check: async ({github, context, core}) => {
    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const pull_number = context.issue.number;

    // Get all reviews for this PR
    const {data: reviews} = await github.rest.pulls.listReviews({
      owner,
      repo,
      pull_number,
    });

    // TODO: Fetch using API (based on team name)
    const code_owners = [];
    const {data: members} = await github.rest.teams.listMembersInOrg({
      org: owner,
      team_slug: CODE_OWNER_MIGRATIONS_TEAM_NAME,
    });

    if (!members) {
      core.setFailed(`No members found in ${CODE_OWNER_MIGRATIONS_TEAM_NAME}`);
    }

    console.log(members); // eslint-disable-line no-console

    const approved = reviews.some(
      review => code_owners.includes(review.user.login) && review.state === 'APPROVED'
    );

    if (!approved) {
      core.setFailed('Migration not approved by @getsentry/owners-migrations');
    }
  },
};
