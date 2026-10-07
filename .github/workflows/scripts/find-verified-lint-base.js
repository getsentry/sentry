import {execFileSync} from 'node:child_process';

export async function findVerifiedLintBase({github, context, core}) {
  const git = args =>
    execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  try {
    const base = git(['rev-parse', 'HEAD^1']);
    const {data} = await github.rest.actions.listWorkflowRuns({
      ...context.repo,
      workflow_id: 'frontend.yml',
      event: 'push',
      branch: 'master',
      per_page: 100,
    });
    // ponytail: inspect 100 recent runs; scan the base when proof needs older history.
    for (const run of data.workflow_runs) {
      if (run.event !== 'push' || run.head_branch !== 'master') {
        continue;
      }
      try {
        git(['merge-base', '--is-ancestor', run.head_sha, base]);
      } catch {
        continue;
      }
      const changes = git([
        'diff',
        '--name-only',
        '--no-renames',
        '-z',
        run.head_sha,
        base,
        '--',
      ])
        .split('\0')
        .filter(Boolean);
      if (changes.some(file => !/^(?:src|tests)\/.*\.pyi?$/.test(file))) {
        continue;
      }
      const {data: jobs} = await github.rest.actions.listJobsForWorkflowRun({
        ...context.repo,
        run_id: run.id,
        filter: 'latest',
        per_page: 100,
      });
      if (
        jobs.jobs.some(
          job =>
            job.name === 'oxlint' &&
            job.head_sha === run.head_sha &&
            job.steps?.some(
              step => step.name === 'Verify lint ratchet' && step.conclusion === 'success'
            )
        )
      ) {
        core.info(`Reusing lint baseline verified at ${run.head_sha} for ${base}`);
        return base;
      }
    }
  } catch (error) {
    core.info(`Cannot verify lint baseline: ${error.message}`);
  }
  core.info('No verified lint baseline found; scanning the base revision');
  return '';
}
