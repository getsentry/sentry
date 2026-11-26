/**
 * Sets the `sha` output to the commit a pull request branched from, so a later
 * step can compare the PR's files with their versions there.
 *
 * Invoked from the lint job in `.github/workflows/pre-commit.yml` via
 * actions/github-script.
 */

/**
 * The subset of the actions/github-script context we use, typed locally
 * because @actions/github isn't a repo dependency.
 */
interface MergeBaseArgs {
  context: {
    payload: {pull_request: {base: {sha: string}; head: {sha: string}}};
    repo: {owner: string; repo: string};
  };
  core: {
    info: (message: string) => void;
    setOutput: (name: string, value: string) => void;
  };
  github: {
    rest: {
      repos: {
        compareCommits: (params: {
          base: string;
          head: string;
          owner: string;
          repo: string;
        }) => Promise<{data: {merge_base_commit: {sha: string}}}>;
      };
    };
  };
}

export async function setMergeBase({
  github,
  context,
  core,
}: MergeBaseArgs): Promise<void> {
  const pr = context.payload.pull_request;
  // the base branch's tip can be ahead of where the PR branched, so ask github for the fork point
  const {data} = await github.rest.repos.compareCommits({
    ...context.repo,
    base: pr.base.sha,
    head: pr.head.sha,
  });
  core.info(`Merge base: ${data.merge_base_commit.sha}`);
  core.setOutput('sha', data.merge_base_commit.sha);
}
