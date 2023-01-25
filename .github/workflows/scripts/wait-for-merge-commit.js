const MAX_WAIT_MS = 10 * 1000; // 10s
const WAIT_PERIOD = 0.5 * 1000; // 0.5s

function wait(interval) {
  return new Promise(resolve => {
    setTimeout(resolve, interval);
  });
}

async function waitForMergeCommit({github, context, core}) {
  const pullRequest = context.payload.pull_request;
  const pullNumber = pullRequest.number;

  let timedOut = false;
  let mergeable = false;
  let mergeCommitSha = null;

  const start = new Date().getTime();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const response = await github.rest.pulls.get({
      ...context.repo,
      pull_number: pullNumber,
    });
    if (response.status === 200) {
      mergeable = response.data.mergeable;
      if (mergeable) {
        mergeCommitSha = response.data.merge_commit_sha;
        break;
      }
    } else {
      core.info('None 200 response: ', response);
    }

    await wait(WAIT_PERIOD);
    const now = new Date().getTime();
    if (now - start > MAX_WAIT_MS) {
      timedOut = true;
      break;
    }
  }

  core.setOutput('timedOut', timedOut);
  core.setOutput('mergeable', mergeable);
  core.setOutput('mergeCommitSha', mergeCommitSha);

  core.startGroup('Finished waiting for merge commit.');
  core.info(`Timed out: ${timedOut}`);
  core.info(`Mergeable: ${mergeable}`);
  core.info(`Merge commit SHA: ${mergeCommitSha}`);
  core.info(`PR head SHA: ${pullRequest.head.sha}`);
  core.endGroup();
}

module.exports = {
  waitForMergeCommit,
};
