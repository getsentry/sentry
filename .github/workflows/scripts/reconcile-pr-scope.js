export const FRONTEND_LABEL = 'Scope: Frontend';
export const BACKEND_LABEL = 'Scope: Backend';
export const COMMENT_MARKER = '<!-- FRONTEND_BACKEND_WARNING -->';

export const WARNING_BODY = `${COMMENT_MARKER}
🚨 **Warning:** This pull request contains Frontend and Backend changes!

It's discouraged to make changes to Sentry's Frontend and Backend in a single pull request. The Frontend and Backend are **not** atomically deployed. If the changes are interdependent of each other, they **must** be separated into two pull requests and be made forward or backwards compatible, such that the Backend or Frontend can be safely deployed independently.

Have questions? Please ask in the [\`#discuss-dev-infra\` channel](https://app.slack.com/client/T024ZCV9U/CTJL7358X).`;

function count(outputs, name) {
  const value = outputs[name];
  const parsed = Number(value);
  if (value === undefined || value === '' || !Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`Expected ${name} to be a non-negative integer, got: ${value}`);
  }
  return parsed;
}

export function deriveScopeState(pathFilterOutputs) {
  const frontendChanges = count(pathFilterOutputs, 'frontend_all_count');
  const backendChanges = count(pathFilterOutputs, 'backend_src_count');
  const frontendWarningExemptions = count(pathFilterOutputs, 'api_url_codegen_count');
  const backendWarningExemptions =
    count(pathFilterOutputs, 'embed_widget_codegen_count') +
    count(pathFilterOutputs, 'integration_test_utils_count');

  return {
    frontend: frontendChanges > 0,
    backend: backendChanges > 0,
    shouldWarn:
      frontendChanges > frontendWarningExemptions &&
      backendChanges > backendWarningExemptions,
  };
}

export async function reconcilePrScope({github, context, core, pathFilterOutputs}) {
  const {owner, repo} = context.repo;
  const issue_number = context.payload.pull_request.number;
  const scopeState = deriveScopeState(pathFilterOutputs);

  const {data: pullRequest} = await github.rest.issues.get({owner, repo, issue_number});
  const currentLabels = new Set(pullRequest.labels.map(label => label.name));
  const desiredLabels = new Map([
    [FRONTEND_LABEL, scopeState.frontend],
    [BACKEND_LABEL, scopeState.backend],
  ]);

  for (const [name, shouldExist] of desiredLabels) {
    if (shouldExist && !currentLabels.has(name)) {
      await github.rest.issues.addLabels({owner, repo, issue_number, labels: [name]});
      core.info(`Added ${name} to #${issue_number}.`);
    } else if (!shouldExist && currentLabels.has(name)) {
      await github.rest.issues.removeLabel({owner, repo, issue_number, name});
      core.info(`Removed stale ${name} from #${issue_number}.`);
    }
  }

  const comments = await github.paginate(github.rest.issues.listComments, {
    owner,
    repo,
    issue_number,
    per_page: 100,
  });
  const warning = comments.find(
    comment =>
      comment.user?.login === 'github-actions[bot]' &&
      comment.body?.includes(COMMENT_MARKER)
  );

  if (scopeState.shouldWarn && !warning) {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number,
      body: WARNING_BODY,
    });
    core.info(`Posted frontend/backend warning on #${issue_number}.`);
  } else if (!scopeState.shouldWarn && warning) {
    await github.rest.issues.deleteComment({owner, repo, comment_id: warning.id});
    core.info(`Deleted stale frontend/backend warning on #${issue_number}.`);
  } else {
    core.info(`Frontend/backend warning on #${issue_number} is already correct.`);
  }
}
