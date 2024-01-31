/* eslint-env node */

module.exports = {
  check: async ({github, context, core, team_slug}) => {
    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const pull_number = context.issue.number;

    // Get all reviews for this PR
    const {data: reviews} = await github.rest.pulls.listReviews({
      owner,
      repo,
      pull_number,
    });

    // Collect all members of the team
    const {data: members} = await github.rest.teams.listMembersInOrg({
      org: owner,
      team_slug,
    });
    if (!members) {
      core.setFailed(`No members found in ${team_slug}`);
      return;
    }
    const memberIds = members.map(member => member.id);

    // Check if any member of the team approved this PR
    const isApprovedByMember = reviews.some(
      review => memberIds.includes(review.user.id) && review.state === 'APPROVED'
    );

    if (!isApprovedByMember) {
      core.setFailed(`No ${team_slug} member approved this PR`);
    }
  },
};
