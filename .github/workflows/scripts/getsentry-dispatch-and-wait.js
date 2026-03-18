/**
 * Dispatch a workflow to getsentry and wait for it to complete.
 *
 * Returns { runId, conclusion } on completion, or throws on timeout.
 */
export async function dispatchAndWait({
  github,
  core,
  workflow_id,
  inputs,
  // How long to poll for the run to appear after dispatch (ms)
  findTimeoutMs = 60_000,
  // How long to wait for the run to complete (ms)
  waitTimeoutMs = 600_000,
}) {
  const owner = 'getsentry';
  const repo = 'getsentry';

  // Record time before dispatch with generous buffer for clock skew
  // between GitHub's API servers and the runner.
  const before = new Date();
  before.setSeconds(before.getSeconds() - 30);

  await apiCallWithRetry(core, () =>
    github.rest.actions.createWorkflowDispatch({
      owner,
      repo,
      workflow_id,
      ref: 'master',
      inputs,
    })
  );
  core.info(`Dispatched ${workflow_id} to getsentry`);

  // Find the dispatched run. The run may take a few seconds to appear in the
  // API due to eventual consistency.
  let runId;
  const findDeadline = Date.now() + findTimeoutMs;
  while (Date.now() < findDeadline) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const {
        data: {workflow_runs},
      } = await github.rest.actions.listWorkflowRuns({
        owner,
        repo,
        workflow_id,
        event: 'workflow_dispatch',
        created: `>=${before.toISOString()}`,
        per_page: 5,
      });
      if (workflow_runs.length > 0) {
        // Most recent run first (default sort)
        runId = workflow_runs[0].id;
        core.info(
          `Found getsentry run: ${runId} (status=${workflow_runs[0].status}, created=${workflow_runs[0].created_at})`
        );
        break;
      }
    } catch (err) {
      core.warning(`Error listing workflow runs (will retry): ${err.message}`);
    }
  }
  if (!runId) {
    throw new Error(
      `Could not find dispatched ${workflow_id} run after ${findTimeoutMs / 1000}s. ` +
        `Searched for workflow_dispatch runs created >= ${before.toISOString()}.`
    );
  }

  // Wait for completion
  const waitDeadline = Date.now() + waitTimeoutMs;
  let lastStatus = '';
  while (Date.now() < waitDeadline) {
    await new Promise((r) => setTimeout(r, 10_000));
    let run;
    try {
      ({data: run} = await github.rest.actions.getWorkflowRun({
        owner,
        repo,
        run_id: runId,
      }));
    } catch (err) {
      core.warning(`Error checking run status (will retry): ${err.message}`);
      continue;
    }
    if (run.status !== lastStatus) {
      core.info(`Run ${runId}: ${run.status}`);
      lastStatus = run.status;
    }
    if (run.status === 'completed') {
      if (run.conclusion !== 'success') {
        core.warning(
          `Getsentry run ${runId} concluded with: ${run.conclusion} (${run.html_url})`
        );
      }
      return {runId: String(runId), conclusion: run.conclusion};
    }
  }
  throw new Error(
    `Timed out after ${waitTimeoutMs / 1000}s waiting for ${workflow_id} run ${runId}. ` +
      `Last status: ${lastStatus}. See: https://github.com/${owner}/${repo}/actions/runs/${runId}`
  );
}

async function apiCallWithRetry(core, fn, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxRetries) throw err;
      const delay = attempt * 2000;
      core.warning(
        `API call failed (attempt ${attempt}/${maxRetries}): ${err.message}. Retrying in ${delay}ms...`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
