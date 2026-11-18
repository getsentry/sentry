/* eslint-disable boundaries/no-unknown-files, eslint-js/no-restricted-syntax -- This standalone Django page serves its JavaScript independently of the Sentry application. */
// The live controls call the same organization endpoints as any Sentry client.
const context = document.documentElement.dataset;
const organizationAPI = context.organizationApi;
const runsURL = organizationAPI + 'investigation-workflows/runs/';
const runURL = id => runsURL + encodeURIComponent(id) + '/';
const storageKey = key => [context.user, context.organization, key].join(':');
const storage = {
  getItem: key => localStorage.getItem(storageKey(key)),
  setItem: (key, value) => localStorage.setItem(storageKey(key), value),
  removeItem: key => localStorage.removeItem(storageKey(key)),
};

async function requestJSON(url, body) {
  const response = await fetch(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-CSRFToken': context.csrf,
      Accept: 'application/json',
    },
    ...(body === undefined ? {} : {body: JSON.stringify(body)}),
  });
  const result = await response.json().catch(() => null);
  if (response.ok && result !== null) {
    return result;
  }
  const detail = result?.detail;
  const error = new Error(
    typeof detail === 'string'
      ? detail
      : JSON.stringify(detail) || 'Sentry returned HTTP ' + response.status
  );
  error.status = response.status;
  throw error;
}

let submission;
let proof;
async function startWorkflow(body, examples) {
  const {workflow, input} = body;
  if (body.scenario !== 'agent') {
    const started = Date.now();
    const result = await requestJSON('editor/', {action: 'proof', ...body});
    const last = kind => result.events.findLast(event => event.kind === kind) || {};
    const checkpoint = last('checkpoint');
    proof = {
      id: 'proof-' + started,
      mode: 'proof',
      scenario: body.scenario,
      status: result.success ? 'succeeded' : 'failed',
      done: true,
      notebook: false,
      error: result.success
        ? null
        : last('error').message || 'Recovery simulation failed.',
      definition: workflow,
      source_workflow: workflow,
      input,
      nodes: {},
      output: last('result').output ?? null,
      events: result.events,
      proof: {
        checks: last('check').checks,
        checkpoint: checkpoint.checkpoint,
        children: checkpoint.children,
      },
      metrics: {elapsed_ms: Date.now() - started},
    };
    return proof;
  }
  const serialized = JSON.stringify(body);
  if (submission?.body !== serialized) {
    submission = {
      body: serialized,
      id: crypto.randomUUID ? crypto.randomUUID() : newUUID(),
    };
  }
  const preset = Object.values(examples).find(
    example => JSON.stringify(example.workflow) === JSON.stringify(workflow)
  );
  const name = preset
    ? workflow.name
    : (await requestJSON('editor/', {action: 'register', workflow, input})).id;
  const accepted = await requestJSON(runsURL, {
    workflow: name,
    input,
    maxAttempts: body.max_attempts,
    requestId: submission.id,
  });
  submission = undefined;
  return accepted;
}

// randomUUID requires HTTPS, but the development Sentry host also supports HTTP.
function newUUID() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

async function getRun(id) {
  if (id.startsWith('proof-')) {
    if (proof?.id === id) {
      return proof;
    }
    throw new Error('Recovery results belong to the browser session that ran them.');
  }
  return presentRun(await requestJSON(runURL(id) + '?activity=1'));
}

function usageMetrics(usage, blocks) {
  const totals = {},
    models = new Map();
  for (const row of usage) {
    const key = JSON.stringify([row.model, row.region]);
    const model = models.get(key) || {model: row.model, region: row.region};
    for (const [field, value] of Object.entries(row)) {
      if (typeof value === 'number') {
        model[field] = (model[field] || 0) + value;
        totals[field] = (totals[field] || 0) + value;
      }
    }
    models.set(key, model);
  }
  return {
    totals,
    models: [...models.values()],
    has_usage: usage.length > 0,
    tool_calls: blocks.reduce(
      (sum, block) => sum + (block.message.tool_calls?.length || 0),
      0
    ),
  };
}

function presentRun(run) {
  const nodes = Object.create(null);
  const byId = new Map();
  const dependencies = Object.create(null);
  const allBlocks = [];
  for (const node of run.nodes) {
    const attempts = [...(node.attempts || [])];
    if (node.kind === 'llm' && node.output !== null && node.output !== undefined) {
      attempts.push({
        attempt: node.attempt,
        kind: 'llm',
        session: {
          usage: node.usage,
          blocks: [
            {
              id: node.id,
              timestamp: node.updatedAt,
              message: {role: 'assistant', content: JSON.stringify(node.output, null, 2)},
            },
          ],
        },
      });
    }
    const blocks = attempts.flatMap(attempt => attempt.session.blocks);
    allBlocks.push(...blocks);
    const usages = attempts.flatMap(attempt => attempt.session.usage?.usages || []);
    const value = {
      ...node,
      attempts,
      item_index: node.item,
      explorer_run_id: node.child,
      max_attempts: run.maxAttempts,
      input_resolved: node.input !== null && node.input !== undefined,
      next_check_at: node.nextCheckAt,
      metrics: usageMetrics(usages, blocks),
      session: {blocks, usage: {usages}},
    };
    byId.set(node.id, value);
    if (!node.parent) {
      nodes[node.name] = value;
      dependencies[node.name] = node.dependencies;
    }
  }
  for (const node of byId.values()) {
    const parent = byId.get(node.parent);
    if (parent) {
      (parent[node.item !== null && node.item !== undefined ? 'items' : 'children'] ??=
        []).push(node);
    }
  }
  function aggregate(node) {
    const children = node.items || node.children;
    if (!children?.length) {
      return;
    }
    children.sort(
      (a, b) =>
        a.item_index - b.item_index ||
        a.round - b.round ||
        String(a.role).localeCompare(String(b.role))
    );
    children.forEach(aggregate);
    const blocks = children.flatMap(child => child.session.blocks);
    const usages = children.flatMap(child => child.session.usage.usages);
    node.session = {blocks, usage: {usages}};
    node.metrics = usageMetrics(usages, blocks);
  }
  Object.values(nodes).forEach(aggregate);
  return {
    ...run,
    nodes,
    dependencies,
    investigation_run_id: run.id,
    mode: 'agent',
    scenario: 'agent',
    definition: run.workflow,
    output_node: run.workflow.output.slice(1),
    metrics: {
      ...usageMetrics(run.usage.usages, allBlocks),
      elapsed_ms:
        (run.finishedAt ? Date.parse(run.finishedAt) : Date.now()) -
        Date.parse(run.createdAt),
    },
  };
}

function syncNotebook(lastSnapshot, view) {
  const enabled = Boolean(lastSnapshot?.notebook);
  document.querySelector('[data-view="notebook"]').classList.toggle('hidden', !enabled);
  const pane = document.getElementById('notebook');
  if (view !== 'notebook' || !enabled) {
    pane.replaceChildren();
    return;
  }
  if (!lastSnapshot.notebookId) {
    pane.textContent = lastSnapshot.done
      ? 'This run ended before a notebook was created.'
      : 'Waiting for the notebook agent to open the notebook…';
    return;
  }
  const url =
    'notebook/?id=' +
    encodeURIComponent(lastSnapshot.notebookId) +
    '&live=' +
    Number(!lastSnapshot.done);
  if (pane.firstElementChild?.getAttribute('src') === url) {
    return;
  }
  const frame = document.createElement('iframe');
  frame.title = 'Workflow notebook';
  frame.src = url;
  pane.replaceChildren(frame);
}

export {getRun, requestJSON, runURL, startWorkflow, storage, syncNotebook};
