import {WorkflowActivity} from './activity.js';
import {WorkflowErrors} from './errors.js';
import {WorkflowGraph} from './graph.js';
import {
  getRun,
  requestJSON,
  runURL,
  startWorkflow,
  storage,
  syncNotebook,
} from './transport.js';
/* eslint-disable boundaries/no-unknown-files, eslint-js/no-restricted-syntax, no-loop-func, no-shadow -- This standalone Django page serves its JavaScript independently of the Sentry application. */
const $ = id => document.getElementById(id),
  fmt = x => JSON.stringify(x, null, 2),
  esc = x =>
    String(x ?? '').replace(
      /[&<>"']/g,
      c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[c]
    );
let runId = null,
  events = null,
  lastSnapshot = null,
  scenario = 'agent',
  cases = {},
  activeTab = 'workflow',
  layout = 'split-right',
  view = 'activity',
  aux = 'input';
let timerBase = 0,
  timerAnchor = 0,
  timerRunning = false,
  lastTick = 0;
const editors = {};
const errors = new WorkflowErrors($('errors'), $('errorsTab'));
const emptyBlocks = $('blocks').innerHTML,
  emptyProof = $('proof').innerHTML;
let editorMode = storage.getItem('workflow-debug-editor-mode') || 'json';
const graph = new WorkflowGraph($('graphView'));
function renderGraph() {
  if (editorMode !== 'graph') {
    return;
  }
  try {
    if (lastSnapshot?.definition) {
      graph.render(
        lastSnapshot.definition,
        lastSnapshot.nodes,
        lastSnapshot.dependencies,
        true
      );
    } else {
      graph.render(JSON.parse(editorValue('workflow')));
    }
  } catch (error) {
    $('graphView').textContent = 'Fix the JSON to preview the graph: ' + error.message;
  }
}
function setEditorMode(mode) {
  editorMode = mode;
  storage.setItem('workflow-debug-editor-mode', mode);
  $('jsonEditor').classList.toggle('hidden', mode !== 'json');
  $('graphView').classList.toggle('hidden', mode !== 'graph');
  for (const name of ['json', 'graph']) {
    $(name + 'Toggle').classList.toggle('active', mode === name);
    $(name + 'Toggle').setAttribute('aria-pressed', String(mode === name));
  }
  if (mode === 'graph') {
    renderGraph();
  } else {
    refreshEditors();
  }
}
$('jsonToggle').onclick = () => setEditorMode('json');
$('graphToggle').onclick = () => setEditorMode('graph');
for (const id of ['workflow', 'input', 'fixture', 'resultJson']) {
  if (window.CodeMirror) {
    editors[id] = window.CodeMirror.fromTextArea($(id), {
      theme: 'sentry-dark',
      mode: {name: 'javascript', json: true},
      lineNumbers: true,
      lineWrapping: true,
      indentUnit: 2,
      tabSize: 2,
      matchBrackets: true,
      readOnly: id === 'resultJson',
      extraKeys: {
        'Ctrl-Enter': () => startRun(),
        'Cmd-Enter': () => startRun(),
        'Shift-Alt-F': () => formatWorkflow(),
      },
    });
  } else {
    $('editorHint').textContent = 'CodeMirror unavailable · plain text';
  }
}
const editorValue = id => (editors[id] ? editors[id].getValue() : $(id).value);
function setEditor(id, value) {
  const e = editors[id];
  if (e) {
    if (e.getValue() !== value) {
      const pos = e.getScrollInfo();
      e.setValue(value);
      e.scrollTo(pos.left, pos.top);
    }
  } else {
    $(id).value = value;
  }
}
function refreshEditors() {
  requestAnimationFrame(() => {
    Object.values(editors).forEach(e => e.refresh());
    WorkflowActivity.refreshCode($('blocks'));
  });
}
$('blocks').addEventListener(
  'toggle',
  () => WorkflowActivity.refreshCode($('blocks')),
  true
);
function showAux(id) {
  aux = id;
  for (const name of ['input', 'fixture', 'errors']) {
    (editors[name]?.getWrapperElement() || $(name)).classList.toggle(
      'hidden',
      name !== id
    );
    const button = $(
      name === 'input' ? 'inputTab' : name === 'fixture' ? 'fixtureTab' : 'errorsTab'
    );
    button.classList.toggle('active', name === id);
    button.setAttribute('aria-selected', String(name === id));
  }
  $('inputHint').textContent =
    id === 'errors'
      ? 'Expand an error to inspect and copy its details.'
      : id === 'input'
        ? 'Data for this run, available to the node as $input.'
        : '';
  refreshEditors();
}
function applyLayout() {
  const w = $('workspace');
  w.className = layout;
  $('workflowPane').classList.toggle(
    'hidden',
    layout === 'tabs' && activeTab !== 'workflow'
  );
  $('resultsPane').classList.toggle(
    'hidden',
    layout === 'tabs' && activeTab !== 'results'
  );
  for (const t of ['workflow', 'results']) {
    $(t + 'Tab').classList.toggle('active', t === activeTab);
    $(t + 'Tab').setAttribute('aria-selected', String(t === activeTab));
  }
  for (const [id, name] of [
    ['tabsOnly', 'tabs'],
    ['splitRight', 'split-right'],
    ['splitDown', 'split-down'],
  ]) {
    $(id).classList.toggle('active', layout === name);
    $(id).setAttribute('aria-pressed', String(layout === name));
  }
  refreshEditors();
}
for (const t of ['workflow', 'results']) {
  $(t + 'Tab').onclick = () => {
    activeTab = t;
    applyLayout();
    if (t === 'workflow') {
      editors.workflow?.focus();
    }
  };
}
for (const [id, name] of [
  ['tabsOnly', 'tabs'],
  ['splitRight', 'split-right'],
  ['splitDown', 'split-down'],
]) {
  $(id).onclick = () => {
    layout = layout === name && name !== 'tabs' ? 'tabs' : name;
    document.documentElement.style.setProperty('--split', '50%');
    storage.setItem('workflow-debug-layout', layout);
    applyLayout();
  };
}
$('splitter').onpointerdown = e => {
  if (e.button !== 0) {
    return;
  }
  e.preventDefault();
  const d = $('splitter');
  d.setPointerCapture(e.pointerId);
  d.classList.add('dragging');
  d.onpointermove = ev => {
    const r = $('workspace').getBoundingClientRect();
    const ratio =
      layout === 'split-down'
        ? (ev.clientY - r.top) / r.height
        : (ev.clientX - r.left) / r.width;
    document.documentElement.style.setProperty(
      '--split',
      Math.max(25, Math.min(75, ratio * 100)) + '%'
    );
    refreshEditors();
  };
  d.onlostpointercapture = () => {
    d.onpointermove = null;
    d.classList.remove('dragging');
  };
};
$('splitter').onkeydown = e => {
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault();
    const n =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue('--split')
      ) || 50;
    document.documentElement.style.setProperty(
      '--split',
      Math.max(
        25,
        Math.min(75, n + (['ArrowLeft', 'ArrowUp'].includes(e.key) ? -5 : 5))
      ) + '%'
    );
    refreshEditors();
  }
};
$('inputTab').onclick = () => showAux('input');
$('fixtureTab').onclick = () => showAux('fixture');
$('errorsTab').onclick = () => showAux('errors');
showAux('input');
function resizeInputs(height) {
  const max = Math.max(80, $('workflowPane').clientHeight * 0.7),
    value = Math.max(80, Math.min(max, height));
  document.documentElement.style.setProperty('--input-height', value + 'px');
  storage.setItem('workflow-debug-input-height', String(value));
  refreshEditors();
}
const savedInputHeight = Number(storage.getItem('workflow-debug-input-height'));
if (savedInputHeight > 0) {
  document.documentElement.style.setProperty('--input-height', savedInputHeight + 'px');
}
$('inputSplitter').onpointerdown = e => {
  if (e.button !== 0) {
    return;
  }
  e.preventDefault();
  const divider = $('inputSplitter'),
    y = e.clientY,
    height = $('inputArea').getBoundingClientRect().height;
  divider.setPointerCapture(e.pointerId);
  divider.classList.add('dragging');
  divider.onpointermove = event => resizeInputs(height + y - event.clientY);
  divider.onlostpointercapture = () => {
    divider.onpointermove = null;
    divider.classList.remove('dragging');
  };
};
$('inputSplitter').onkeydown = e => {
  if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) {
    return;
  }
  e.preventDefault();
  const height = $('inputArea').getBoundingClientRect().height;
  resizeInputs(
    e.key === 'Home'
      ? 80
      : e.key === 'End'
        ? $('workflowPane').clientHeight
        : height + (e.key === 'ArrowUp' ? 24 : -24)
  );
};
new ResizeObserver(() => {
  $('inputSplitter').setAttribute(
    'aria-valuenow',
    Math.round($('inputArea').getBoundingClientRect().height)
  );
  $('inputSplitter').setAttribute(
    'aria-valuemax',
    Math.max(80, Math.round($('workflowPane').clientHeight * 0.7))
  );
  refreshEditors();
}).observe($('inputArea'));
function renderJSON() {
  if (!lastSnapshot) {
    return;
  }
  setEditor(
    'resultJson',
    view === 'state'
      ? fmt(lastSnapshot)
      : lastSnapshot.output === null
        ? fmt({status: lastSnapshot.status, error: lastSnapshot.error})
        : fmt(lastSnapshot.output)
  );
}
function showView(name) {
  view = name;
  document.querySelectorAll('[data-view]').forEach(b => {
    b.classList.toggle('active', b.dataset.view === name);
    b.setAttribute('aria-selected', String(b.dataset.view === name));
  });
  for (const id of ['activity', 'usage', 'proof', 'notebook']) {
    $(id).classList.toggle('hidden', id !== name);
  }
  $('jsonView').classList.toggle('hidden', !['state', 'output'].includes(name));
  refreshContextHelp();
  renderJSON();
  refreshEditors();
  syncNotebook(lastSnapshot, view);
}
for (const b of document.querySelectorAll('[data-view]')) {
  b.onclick = () => showView(b.dataset.view);
}
const detail = (title, data) =>
  `<details><summary>${esc(title)}</summary><pre>${esc(typeof data === 'string' ? data : fmt(data))}</pre></details>`;
function stableRender(el, html) {
  const open = [...el.querySelectorAll('details')]
    .filter(d => d.open)
    .map(d => d.querySelector('summary')?.textContent);
  el.innerHTML = html;
  el.querySelectorAll('details').forEach(d => {
    if (open.includes(d.querySelector('summary')?.textContent)) {
      d.open = true;
    }
  });
}
function message(value, bad = false) {
  if (bad) {
    errors.add(value);
    showAux('errors');
    activeTab = 'workflow';
    applyLayout();
    return;
  }
  $('status').textContent = value;
  $('status').dataset.tipTitle = 'Status';
  $('status').dataset.tipText = value;
}
function clearRun() {
  events?.close();
  events = null;
  runId = null;
  lastSnapshot = null;
  syncNotebook(lastSnapshot, view);
  storage.removeItem('workflow-debug-run');
  timerBase = 0;
  timerRunning = false;
  $('timer').textContent = '0 ms';
  for (const id of ['runId', 'resultDot']) {
    $(id).textContent = '';
  }
  $('runStatus').textContent = 'IDLE';
  $('runStatus').className = 'badge';
  for (const editor of $('blocks').activityEditors || []) {
    editor.toTextArea();
  }
  $('blocks').activityEditors = [];
  $('blocks').activityMarkup = null;
  $('blocks').innerHTML = emptyBlocks;
  $('proof').innerHTML = emptyProof;
  setEditor('resultJson', '');
  renderMetrics(null);
  errors.clear();
  showAux('input');
  graph.expanded.clear();
  graph.sections.clear();
  graph.signature = '';
  graph.zoom = null;
  renderGraph();
  $('stop').disabled = true;
  $('clearRun').disabled = false;
  showView('activity');
  message('Ready');
}
$('clearRun').onclick = () => {
  if (!$('run').disabled) {
    clearRun();
  }
};
const number = x => (x === null || x === undefined ? '—' : Number(x).toLocaleString()),
  money = x => (x === null || x === undefined ? '—' : '$' + Number(x).toFixed(6));
function updateTimer(now) {
  if (now - lastTick > 30) {
    $('timer').textContent =
      Math.floor(timerBase + (timerRunning ? now - timerAnchor : 0)).toLocaleString() +
      ' ms';
    lastTick = now;
  }
  requestAnimationFrame(updateTimer);
}
requestAnimationFrame(updateTimer);
function renderMetrics(v) {
  const m = v?.metrics || {},
    t = m.totals || {},
    has = m.has_usage;
  $('metrics').innerHTML = [
    ['Total tokens', has ? number(t.total_tokens) : '—', 'totalTokens'],
    ['Input tokens', has ? number(t.prompt_tokens) : '—', 'inputTokens'],
    ['Output tokens', has ? number(t.completion_tokens) : '—', 'outputTokens'],
    ['Estimated cost', has ? money(t.dollar_cost) : '—', 'cost'],
    ['Tool calls', number(m.tool_calls), 'toolCalls'],
    [
      'Execution',
      v?.mode === 'proof' ? 'Simulated response' : v ? 'Real model' : 'Not started',
      'execution',
    ],
  ]
    .map(
      ([k, value, tip]) =>
        '<div class="metric" tabindex="0" data-tip="' +
        tip +
        '"><span>' +
        esc(k) +
        '</span><b>' +
        esc(value) +
        '</b></div>'
    )
    .join('');
  const rows = m.models || [];
  $('modelsUsed').innerHTML = rows.length
    ? '<div class="table-scroll"><table><thead><tr>' +
      [
        ['Actual model', 'actualModel'],
        ['Region', 'region'],
        ['Input', 'inputTokens'],
        ['Output', 'outputTokens'],
        ['Total', 'totalTokens'],
        ['Cache read', 'cacheRead'],
        ['Cache write', 'cacheWrite'],
        ['Reasoning', 'reasoning'],
        ['Cost', 'cost'],
      ]
        .map(([h, tip]) => '<th tabindex="0" data-tip="' + tip + '">' + h + '</th>')
        .join('') +
      '</tr></thead><tbody>' +
      rows
        .map(
          r =>
            '<tr>' +
            [
              r.model || 'Not reported',
              r.region || 'Not reported',
              number(r.prompt_tokens),
              number(r.completion_tokens),
              number(r.total_tokens),
              number(r.prompt_cache_read_tokens),
              number(r.prompt_cache_write_tokens),
              number(r.thinking_tokens),
              money(r.dollar_cost),
            ]
              .map(c => '<td>' + esc(c) + '</td>')
              .join('') +
            '</tr>'
        )
        .join('') +
      '</tbody></table></div>'
    : '<p class="note">' +
      (v?.mode === 'proof'
        ? 'This recovery test used a simulated response. No model was called and there is no model token or cost usage.'
        : 'No model usage has been saved yet. Usage can arrive at the end of a turn; unused fallback models are not listed.') +
      '</p>';
  $('runtimeSettings').textContent = fmt(v?.runtime || {});
  $('runtimeSettings').previousElementSibling?.setAttribute('data-tip', 'runtime');
}
function renderProof(v) {
  if (v.mode !== 'proof') {
    $('proof').innerHTML =
      '<div class="empty"><h3>This was a live agent run</h3><p>Live mode runs your nodes through the durable runner and Explorer. It does not inject failures or produce a recovery checklist.</p><p>Choose a failure scenario from the Run menu to inspect recovery and its Postgres rows.</p><button data-help-topic="modes">Explore recovery scenarios</button></div>';
    return;
  }
  const p = v.proof || {},
    c = cases[v.scenario] || {},
    cp = p.checkpoint || {},
    checks = p.checks || [],
    passed = checks.filter(x => x.passed).length;
  const storage = cp.schema
    ? '<section class="storage-card"><h4>Postgres data</h4><p>Database <code>' +
      esc(cp.database) +
      '</code><br>Schema <code>' +
      esc(cp.schema) +
      '</code></p><p class="note">' +
      (cp.data_retained
        ? 'Rows are kept after this test and after the lab closes. Refresh the schema list in TablePlus.'
        : v.done
          ? 'The temporary schema has been removed. Start Sentry with WORKFLOW_LAB_KEEP_PROOF_DATA=1 to inspect the next test in TablePlus.'
          : 'Rows exist while this test runs; the temporary schema will be removed afterward.') +
      '</p><button data-copy-sql data-tip="copySQL">Copy TablePlus query</button>' +
      detail('Read-only query for this test', proofSQL()) +
      '<button class="hint-button" data-help-topic="storage">Which tables should I inspect?</button></section>'
    : '';
  stableRender(
    $('proof'),
    '<div class="proof-info"><div class="proof-title">' +
      esc(c.label || v.scenario) +
      '</div><p class="note">' +
      esc(c.how || '') +
      '</p><p class="note"><b>Expected:</b> ' +
      esc(c.expect || '') +
      '</p></div><div class="check-summary">' +
      (checks.length
        ? passed + ' of ' + checks.length + ' checks passed' + (v.done ? '' : ' so far')
        : 'Waiting for the first check…') +
      '</div><p class="note">These checks run in the lab and are recorded in the session log. They are not stored as a checklist in Postgres.</p>' +
      checks
        .map(
          check =>
            '<div class="check ' +
            (check.passed ? '' : 'failed') +
            '"><i aria-label="' +
            (check.passed ? 'Passed' : 'Failed') +
            '">' +
            (check.passed ? '✓' : '×') +
            '</i><div><strong>' +
            esc(check.label) +
            '</strong><div class="note">' +
            esc(check.explanation || 'This assertion was recorded by the lab harness.') +
            '</div></div></div>'
        )
        .join('') +
      storage +
      detail('Saved workflow and node state', cp) +
      detail('Explorer child IDs, invocations, and queued deliveries', p.children || {})
  );
  const summaries = $('proof').querySelectorAll('summary');
  for (const summary of summaries) {
    if (summary.textContent === 'Saved workflow and node state') {
      summary.dataset.tip = 'checkpoint';
    }
    if (summary.textContent.startsWith('Explorer child IDs')) {
      summary.dataset.tip = 'children';
    }
  }
}
function render(v) {
  lastSnapshot = v;
  syncNotebook(lastSnapshot, view);
  const previousErrors = errors.entries.length;
  errors.capture(v);
  if (v.status === 'failed' && errors.entries.length > previousErrors) {
    showAux('errors');
    activeTab = 'workflow';
    applyLayout();
  }
  timerBase = v.metrics?.elapsed_ms || 0;
  timerAnchor = performance.now();
  timerRunning = !v.done;
  $('runStatus').textContent = v.status.toUpperCase();
  $('runStatus').className =
    'badge ' +
    (v.status === 'succeeded' ? 'success' : v.status === 'failed' ? 'error' : 'running');
  $('resultDot').textContent = v.done ? '' : ' •';
  $('runId').textContent = [
    v.investigation_run_id ? 'Investigation ' + v.investigation_run_id : v.node_id,
    v.explorer_run_id
      ? (v.mode === 'proof' ? 'Isolated child ' : 'Explorer run ') + v.explorer_run_id
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
  renderMetrics(v);
  renderProof(v);
  renderJSON();
  renderGraph();
  WorkflowActivity.render($('blocks'), v);
  $('clearRun').disabled = !v.done;
  $('stop').disabled =
    v.mode === 'proof' ||
    !['pending', 'running', 'awaiting_input'].includes(v.status) ||
    !v.investigation_run_id;
  if (v.done) {
    events?.close();
    $('run').disabled = false;
    $('runMenuToggle').disabled = false;
    message(
      v.mode === 'proof' ? 'Recovery test ' + v.status : 'Live investigation ' + v.status
    );
  }
}
function connect(id) {
  events?.close();
  let closed = false,
    timer;
  events = {
    close() {
      closed = true;
      clearTimeout(timer);
    },
  };
  const poll = async () => {
    try {
      const v = await getRun(id);
      if (closed) {
        return;
      }
      render(v);
    } catch (error) {
      if (closed) {
        return;
      }
      message(error, true);
      if ([401, 403, 404].includes(error.status)) {
        events.close();
        $('run').disabled = false;
        $('clearRun').disabled = false;
        $('runMenuToggle').disabled = false;
        timerRunning = false;
        return;
      }
    }
    if (!closed) {
      timer = setTimeout(poll, 1500);
    }
  };
  poll();
}
function payload() {
  const body = {
    workflow: JSON.parse(editorValue('workflow')),
    input: JSON.parse(editorValue('input')),
    max_attempts: Number($('maxAttempts').value),
    scenario,
  };
  if (scenario !== 'agent') {
    body.fixture = JSON.parse(editorValue('fixture'));
  }
  return body;
}
async function startRun() {
  if ($('run').disabled || document.querySelector('dialog[open]')) {
    return;
  }
  hideTooltip();
  try {
    const body = payload();
    clearRun();
    $('run').disabled = true;
    $('runMenuToggle').disabled = true;
    $('clearRun').disabled = true;
    timerBase = 0;
    timerAnchor = performance.now();
    timerRunning = true;
    message('Starting ' + (cases[scenario]?.label || 'agent'));
    const v = await startWorkflow(body, labConfig.examples);
    runId = v.id;
    storage.setItem('workflow-debug-run', runId);
    lastSnapshot = {...v, output: null, status: 'pending'};
    activeTab = 'results';
    applyLayout();
    showView(scenario === 'agent' ? 'activity' : 'proof');
    connect(runId);
  } catch (e) {
    timerBase = timerRunning ? performance.now() - timerAnchor : timerBase;
    timerRunning = false;
    $('run').disabled = false;
    $('runMenuToggle').disabled = false;
    $('clearRun').disabled = false;
    message(e, true);
  }
}
$('run').onclick = startRun;
$('validate').onclick = async () => {
  try {
    await requestJSON('editor/', {...payload(), action: 'validate'});
    message('Workflow and input are valid.');
  } catch (e) {
    message(e, true);
  }
};
function loadExample(name) {
  const example = labConfig.examples[name];
  if (!example) {
    return;
  }
  if ($('run').disabled) {
    message('Wait for the current run to finish before loading an example.');
    return;
  }
  if (lastSnapshot) {
    clearRun();
  }
  setEditor('workflow', fmt(example.workflow));
  setEditor('input', fmt(example.input));
  setScenario(
    name === 'recovery' ? (scenario === 'agent' ? 'result' : scenario) : 'agent'
  );
  setEditorMode('graph');
  message(example.label + ' loaded. Review the input, then press Run.');
}
function positionExampleMenu() {
  const menu = $('exampleMenu');
  if (!menu.matches(':popover-open')) {
    return;
  }
  const anchor = $('exampleSelect').getBoundingClientRect();
  menu.style.left =
    Math.max(8, Math.min(anchor.left, innerWidth - menu.offsetWidth - 8)) + 'px';
  menu.style.top =
    Math.max(8, Math.min(anchor.bottom + 6, innerHeight - menu.offsetHeight - 8)) + 'px';
}
function openExampleMenu(last = false) {
  hideTooltip();
  $('exampleMenu').showPopover();
  positionExampleMenu();
  const items = [...$('exampleMenu').querySelectorAll('[data-example]')];
  items[last ? items.length - 1 : 0]?.focus();
}
$('exampleSelect').onclick = () => {
  $('exampleMenu').matches(':popover-open')
    ? $('exampleMenu').hidePopover()
    : openExampleMenu();
};
$('exampleSelect').onkeydown = e => {
  if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
    e.preventDefault();
    openExampleMenu(e.key === 'ArrowUp');
  }
};
$('exampleMenu').ontoggle = e =>
  $('exampleSelect').setAttribute('aria-expanded', String(e.newState === 'open'));
$('exampleMenu').onclick = e => {
  const item = e.target.closest('[data-example]');
  if (item) {
    $('exampleMenu').hidePopover();
    loadExample(item.dataset.example);
    $('exampleSelect').focus();
  }
};
$('exampleMenu').onkeydown = e => {
  if (e.key === 'Escape') {
    e.preventDefault();
    $('exampleMenu').hidePopover();
    $('exampleSelect').focus();
    return;
  }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
    return;
  }
  e.preventDefault();
  const items = [...$('exampleMenu').querySelectorAll('[data-example]')],
    current = items.indexOf(document.activeElement);
  const next =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? items.length - 1
        : (current + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
  items[next]?.focus();
};
window.addEventListener('resize', positionExampleMenu);
function restoreDraft(c) {
  const starter = c.examples.breached_metrics;
  setEditor(
    'workflow',
    storage.getItem('workflow-debug-v2-workflow') || fmt(starter.workflow)
  );
  setEditor('input', storage.getItem('workflow-debug-v2-input') || fmt(starter.input));
}
function formatWorkflow() {
  try {
    setEditor('workflow', fmt(JSON.parse(editorValue('workflow'))));
    message('Formatted workflow.json');
  } catch (e) {
    message(e, true);
  }
}
$('format').onclick = formatWorkflow;
$('stop').onclick = async () => {
  try {
    await requestJSON(runURL(runId) + 'commands/', {command: 'cancel'});
    render(await getRun(runId));
    message('Investigation cancelled; agents asked to stop');
  } catch (e) {
    message(e, true);
  }
};
function setScenario(id) {
  if (!cases[id]) {
    return false;
  }
  if ($('run').disabled) {
    message('Wait for the current run to finish before changing modes.');
    return false;
  }
  scenario = id;
  refreshMode();
  $('run').dataset.tipTitle = 'Run ' + cases[id].label;
  $('run').dataset.tipText = cases[id].how + ' Shortcut: Ctrl/Cmd+Enter.';
  $('runMenu').classList.add('hidden');
  $('runMenuToggle').setAttribute('aria-expanded', 'false');
  document
    .querySelectorAll('[data-scenario]')
    .forEach(b => b.classList.toggle('selected', b.dataset.scenario === id));
  if (id === 'agent') {
    showAux('input');
  } else {
    showAux('fixture');
    showView('proof');
  }
  return true;
}
$('runMenuToggle').onclick = () => {
  const open = !$('runMenu').classList.toggle('hidden');
  $('runMenuToggle').setAttribute('aria-expanded', String(open));
  if (open) {
    $('runMenu').querySelector('button')?.focus();
  }
};
document.addEventListener('click', e => {
  if (!e.target.closest('.run-control')) {
    $('runMenu').classList.add('hidden');
    $('runMenuToggle').setAttribute('aria-expanded', 'false');
  }
});
$('runMenu').onkeydown = e => {
  if (e.key === 'Escape') {
    $('runMenu').classList.add('hidden');
    $('runMenuToggle').focus();
  }
  if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
    e.preventDefault();
    const items = [...$('runMenu').querySelectorAll('button')],
      i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  }
};
$('settings').onclick = () => {
  hideTooltip();
  $('settingsDialog').showModal();
};
$('closeSettings').onclick = () => $('settingsDialog').close();
for (const id of ['workflow', 'input', 'fixture']) {
  const save = () => {
    storage.setItem('workflow-debug-v2-' + id, editorValue(id));
    if (id === 'workflow') {
      renderGraph();
    }
  };
  if (editors[id]) {
    editors[id].on('change', save);
  } else {
    $(id).addEventListener('input', save);
  }
}
editors.workflow?.on('cursorActivity', cm => {
  const c = cm.getCursor();
  $('editorStatus').textContent = `Ln ${c.line + 1}, Col ${c.ch + 1} · JSON`;
});
window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    startRun();
  }
});
window.addEventListener('resize', refreshEditors);
const tableRows = rows =>
  '<table><tbody>' +
  rows.map(([a, b]) => '<tr><td>' + a + '</td><td>' + b + '</td></tr>').join('') +
  '</tbody></table>';
const fieldHelp = {
  notebook:
    'When true, publish a notebook after every workflow step succeeds, then save its metadata and next steps. Defaults to false.',
  schema_version: 'The workflow format version. Use 1 with the current schema.',
  name: 'A readable workflow identifier, such as breached_monitors. This names the definition, not an individual run.',
  version:
    'A positive integer for your workflow definition version. Editing this does not publish or deploy the workflow.',
  nodes:
    'Named steps in the workflow. Each starts when its own dependencies succeed, with up to four agents running at once. Independent branches can overlap. Recovery tests use one agent node.',
  kind: '"llm" makes one structured model call, without tools. "agent" runs one agent. "map" runs a nested node for each item. "agent_loop" alternates a coordinator and worker until the coordinator finishes.',
  instructions:
    'The agent’s objective, constraints, and definition of success. Required and nonblank. Tell it to save the structured answer as the workflow_node_result artifact.',
  skills:
    'Names of registered reusable guidance, appended to the instructions. Use [] when instructions alone are enough. A skill does not grant tool permissions.',
  input:
    'The node’s input binding. "$input" passes the complete Workflow input; "$input.query" selects one field. Objects can combine references and literal values. Use "$$5" for the literal string "$5".',
  input_schema:
    'The registered Pydantic input type. At the workflow level it validates Workflow input; at the node level it validates the resolved node input. BreachedMetricInput defines the monitor, project IDs, explicit incident/baseline windows, and seed data.',
  output_schema:
    'The registered Pydantic type for the agent’s saved result. The example uses types including BroadScanArtifact and HypothesisJudgmentArtifact. The coordinator uses the generic loop decision schema. Recovery tests validate Simulated output against the same type.',
  output:
    'The workflow’s result reference. "$investigate" returns that node’s output. Every declared node must succeed, including independent branches that do not feed this result.',
  model_alias:
    'A trusted model configuration name. Agent aliases select Explorer intelligence levels. LLM aliases select registered provider/fallback chains and worker limits; coordinator and judge reuse the old investigation settings. See Model usage for actual models.',
  max_tokens:
    'For llm nodes: maximum generated tokens, passed to the existing LLM client.',
  timeout_seconds:
    'For llm nodes: timeout for a model request. Provider retries and fallback handling remain in the existing client; the registered worker limit bounds total execution.',
  instructions_role:
    'For llm nodes: place instructions and skill text in the system prompt (default), or before the input in the user prompt.',
  temperature: 'Optional model sampling temperature, passed through to the LLM client.',
  seed: 'Optional generation seed, when supported by the provider.',
  reasoning_effort: 'Optional reasoning level, passed through to the selected provider.',
  thinking_budget:
    'Optional provider thinking-token budget; -1 requests dynamic thinking where supported.',
  min_worker_runs:
    'Minimum settled worker executions before a loop may finish. Defaults to 0. The breached-monitor example uses 1. An early finish fails explicitly; retries count as the same worker execution.',
  max_iterations:
    'A positive limit on agent-loop iterations. One iteration can include model and tool activity. This is not the number of workflow retries or a token budget.',
  code_mode_policy:
    'Required registered Code Mode policy: read_only or default in this lab. Every agent node runs with Code Mode only. Direct llm nodes have no tools. read_only restricts Code Mode APIs; sandbox access is controlled separately.',
  enable_bash_mode:
    'Whether Explorer may use its bash/sandbox mode. Defaults to false. Turning this on requires the existing runtime’s sandbox setup; it is separate from Code Mode permissions.',
  enable_coding:
    'Whether Explorer may use its coding capabilities. Defaults to false. This uses the existing coding runtime and may require repository and sandbox context.',
  items:
    'A reference to a list for map, such as "$broad_scan.hypotheses". Saved once, with a maximum of 100 items. Use "$item" in the input binding to pass each value to its agent. An empty list succeeds with [].',
  max_concurrency:
    'The maximum number of active agents for this map. The four-agent limit for the entire run also applies, including agents in other branches.',
  failure_policy:
    'For map: fail (default) blocks downstream nodes after an item exhausts its retries. collect lets siblings finish and returns ordered MapItemOutcome results with item_index, status, output, and error. Downstream schemas must accept these outcomes. Even if all items fail, collection completes with explicit failures; cancellation still stops the run.',
};
const tips = {
  help: [
    'Help & guide',
    'Start here for a walkthrough, every workflow field, recovery scenarios, database storage, and troubleshooting. Shortcut: F1.',
  ],
  workflowTab: [
    'Workflow editor',
    'Edit the definition and the input data. These are browser drafts, not JSON files saved on disk.',
  ],
  resultsTab: [
    'Run results',
    'Inspect the selected run’s activity, output, details, model usage, and recovery checks. In split layouts both panes stay visible.',
  ],
  tabsOnly: [
    'One pane at a time',
    'Use the Workflow and Results tabs to switch views. This changes the layout only.',
  ],
  splitRight: [
    'Side-by-side layout',
    'Show the workflow on the left and results on the right. Drag the divider to resize.',
  ],
  splitDown: [
    'Stacked layout',
    'Show the workflow above the results. Drag the divider to resize.',
  ],
  splitter: [
    'Resize the panes',
    'Drag this divider, or focus it and use the arrow keys. It does not affect execution.',
  ],
  timer: [
    'Elapsed time',
    'Time for the whole lab run, including preparation and recovery. Recovery tests advance deadlines, so their duration is not the real production waiting time.',
  ],
  stop: [
    'Cancel investigation',
    'Cancel the investigation, including paused runs, and ask its agents to stop using Explorer’s normal stop signal. In-flight direct LLM requests may finish, but their late responses are discarded. Saved stop requests are retried if delivery fails. Recovery tests cannot be stopped from this button.',
  ],
  run: [
    'Run the selected mode',
    'Starts the mode selected in the Run menu and shown in the status bar. Live investigation calls a real model; recovery tests use a simulated response. Ctrl/Cmd+Enter also runs it.',
  ],
  runMenuToggle: [
    'Choose what to run',
    'Select Live investigation or a recovery scenario. Selecting a mode does not start it; press Run afterward.',
  ],
  settings: [
    'Session settings',
    'Set attempts per node, inspect database retention and caller identity, and download the session log. Registered types and names are in Field guide.',
  ],
  close: ['Close this window', 'Return to the editor. Escape also closes the dialog.'],
  format: [
    'Format the workflow JSON',
    'Reindent the Workflow definition. This does not run or save a workflow in Postgres.',
  ],
  validate: [
    'Check the setup without running',
    'Validate the workflow, input bindings, registered types, and supported Explorer settings. Recovery mode also validates Simulated output. Does not call a model or create workflow rows.',
  ],
  fields: [
    'Workflow field guide',
    'Read what every JSON field means and which values this lab supports. You can also hover over field names in the editor.',
  ],
  inputTab: [
    'Workflow input',
    'Data for this run, available to the node as $input. It must match the workflow’s input_schema. This is not an agent instruction field.',
  ],
  fixtureTab: [
    'Simulated output',
    'The response used in place of the model during recovery tests. It must match the node’s output_schema. Live investigation ignores this editor.',
  ],
  retention: [
    'Recovery test storage',
    'The current server launch decides whether temporary proof schemas are kept after a test. Open Settings for the active value. WORKFLOW_LAB_KEEP_PROOF_DATA=1 keeps the rows for TablePlus.',
  ],
  environment: [
    'Current environment',
    'These are the server’s actual database, caller identity, and Google Cloud project. Change them with launch flags or environment variables, not workflow JSON.',
  ],
  identity: [
    'Caller identity',
    'The organization, actor, and optional Sentry project chosen when this lab was launched. Used by the backend to scope the run. This is separate from the Google Cloud project used for model calls.',
  ],
  log: [
    'Download the session log',
    'A JSON-lines file from this local lab session: events, errors, check results, and recorded usage. It is not a Postgres table. Older logs stay on disk after a restart.',
  ],
  modeGuide: [
    'Which backend does this use?',
    'Live mode runs your nodes through the durable runner and Explorer. Recovery tests call the real workflow runner and use isolated Postgres rows, a simulated agent, and an in-process queue.',
  ],
  resultsGuide: [
    'About the results tabs',
    'Learn what each tab shows and which values are saved in Postgres versus kept only in the lab session.',
  ],
  activity: [
    'Activity',
    'One chronological feed of messages, tool calls, and run events. Tags identify each node or map item; retry messages show the attempt. Expand tool details and inspect saved JSON results inline.',
  ],
  output: [
    'Output',
    'The final response validated against output_schema. An error or unfinished status appears here when no validated output is available yet.',
  ],
  state: [
    'Run details',
    'The complete lab session snapshot as JSON. Includes UI status, events, metrics, and any persisted checkpoint; it is not one database row.',
  ],
  usage: [
    'Model usage',
    'Actual model/region usage reported by Explorer. Tokens and cost may appear only when a turn is saved. Recovery tests make no LLM calls.',
  ],
  proof: [
    'Recovery checks',
    'Pass/fail assertions performed by the lab after a simulated failure. The check list is in memory and the session log, not a database table.',
  ],
  status: [
    'Run status',
    'Succeeded means this mode completed and its output validated. Failed means validation, agent execution, or a recovery assertion failed; open Errors for the cause and recorded stack trace.',
  ],
  editorStatus: [
    'Editor position',
    'The cursor’s line and column in the workflow JSON. This is only an editing aid.',
  ],
  checkpoint: [
    'Saved workflow state',
    'A snapshot read from the workflow, node, and child rows. Expand it for IDs, status, attempt, lease, scheduling deadlines, and output.',
  ],
  children: [
    'Agent executions and task deliveries',
    'An Explorer child is an agent run. More than one queued delivery can be safe: the same step should execute once per attempt. Invocation counts are measured by the lab, not saved as their own DB column.',
  ],
  totalTokens: [
    'Total tokens',
    'The total reported by the model provider. Accounting can vary by provider; it is not necessarily the sum of all visible token columns.',
  ],
  inputTokens: [
    'Input tokens',
    'Tokens reported for prompts and conversation context sent to the model.',
  ],
  outputTokens: [
    'Output tokens',
    'Tokens reported for generated responses. Provider accounting determines how reasoning tokens are included.',
  ],
  cost: [
    'Estimated cost',
    'Cost reported by the runtime/provider for this run. It is an estimate, not an invoice. Workflow JSON does not need to calculate it.',
  ],
  toolCalls: [
    'Tool calls',
    'Tool calls recorded in Explorer conversation blocks. This is not a count of underlying HTTP requests.',
  ],
  execution: [
    'Execution mode',
    'Real model: Explorer ran the agent. Simulated response: the recovery harness supplied the output without calling a model.',
  ],
  actualModel: [
    'Actual model',
    'Only models with recorded usage are listed. Configured fallback models are not counted unless they actually ran.',
  ],
  region: ['Model region', 'The provider region used for this model’s recorded calls.'],
  cacheRead: [
    'Cache read tokens',
    'Input tokens served from a provider’s prompt cache, as reported by that provider.',
  ],
  cacheWrite: [
    'Cache write tokens',
    'Tokens written to a provider’s prompt cache, where that provider reports them.',
  ],
  reasoning: [
    'Reasoning tokens',
    'Reasoning usage reported by the provider. These may already be included in other totals; do not add every column together.',
  ],
  runtime: [
    'Resolved runtime settings',
    'The model configuration, tool modes, limits, and streaming choices passed to Explorer for this run. This is a snapshot, not a settings editor.',
  ],
  copySQL: [
    'Copy the TablePlus query',
    'Copy a read-only query scoped to this recovery test’s schema. Use it in the database shown here after refreshing the schema list.',
  ],
};
let labConfig = null,
  helpTopic = 'start',
  tooltipOwner = null,
  tipTimer = null;
const topicNames = {
  parity: 'Workflow behavior',
  skills: 'Investigation skills',
  start: 'Start here',
  modes: 'Run scenarios',
  checks: 'Understand checks',
  fields: 'Workflow fields',
  results: 'Tabs & controls',
  storage: 'Postgres & TablePlus',
  setup: 'Setup & troubleshooting',
};
const viewNotes = {
  activity:
    'Messages, tool calls, and run events in chronological order. Small tags identify the node or map item. Tool details expand in place; saved JSON results appear as read-only snippets.',
  output:
    'The final response, validated against output_schema. Recovery tests return your Simulated output; Live investigation returns the real agent’s response.',
  state:
    'The lab’s full session snapshot. This combines UI data, events, metrics, and database checkpoints; it is not a single Postgres row.',
  usage:
    'Usage reported by Explorer and the LLM client, saved after a turn or direct response. Recovery tests make no model calls, so token and cost values are empty.',
  proof:
    'Checks are assertions run by this lab, saved in the session log—not a Postgres table. The saved workflow state below comes from real database rows.',
};
function registeredNamesGuide() {
  const r = labConfig.registry || {};
  const entries = (values, render) =>
    Object.entries(values || {})
      .map(
        ([name, value]) =>
          '<details><summary><code>' +
          esc(name) +
          '</code></summary>' +
          render(value) +
          '</details>'
      )
      .join('') || '<p>No entries registered.</p>';
  const schemas = values =>
    entries(values, value => '<pre><code>' + esc(fmt(value)) + '</code></pre>');
  const bindings = values =>
    tableRows(
      Object.entries(values || {}).map(([name, value]) => [
        '<code>' + esc(name) + '</code>',
        esc(value),
      ])
    );
  return (
    '<h4>What does “registered” mean?</h4><p>When the Lab starts, Python supplies a lookup table of names and their definitions. Your workflow JSON selects those names. The runner looks up the definitions to validate data, assemble instructions, choose a model, and configure Code Mode.</p>' +
    tableRows([
      [
        '<code>"input_schema": "BreachedMetricInput"</code>',
        'Selects the existing Pydantic model for the breached metric monitor source. The JSON names the type; the Python model defines its fields and validation rules. <code>output_schema</code> works the same way for the result.',
      ],
      [
        '<code>"skills": ["broad-scan"]</code>',
        'Selects reusable instruction text. The runner appends that text to your node’s <code>instructions</code>. You can edit instructions directly or use <code>skills: []</code>. A skill does not grant tool access.',
      ],
      [
        '<code>"model_alias": "balanced"</code>',
        'Selects a model mapping. The default Lab maps <code>balanced</code> to Explorer’s <code>medium</code> intelligence level. Explorer chooses the actual model and fallbacks; this is not a model ID.',
      ],
      [
        '<code>"code_mode_policy": "read_only"</code>',
        'Selects the existing Code Mode read-only restrictions. Agent nodes always enable Code Mode. Direct llm nodes have no tools and do not accept this field. This does not make the separate bash or coding modes read-only.',
      ],
    ]) +
    '<p>Edit the workflow on the left to choose different registered names or change the node’s instructions, bindings, and modes. Typing a new name does not create a Python model, skill, model mapping, or policy: validation rejects unknown names.</p><h4>Available in this Lab</h4><p>This is reference information for your JSON. Expand a name to see the definition behind it.</p><details><summary>Input types and their data rules</summary>' +
    schemas(r.input_schemas) +
    '</details><details><summary>Output types and their data rules</summary>' +
    schemas(r.output_schemas) +
    '</details><details><summary>Skills and the text added to instructions</summary>' +
    entries(r.skills, text => '<pre>' + esc(text) + '</pre>') +
    '</details><details><summary>Model aliases → Explorer intelligence level</summary>' +
    bindings(r.model_aliases) +
    '</details><details><summary>LLM aliases → direct-call configuration</summary>' +
    entries(r.llm_model_aliases, value => '<pre>' + esc(fmt(value)) + '</pre>') +
    '</details><details><summary>Code Mode policies → runtime policy</summary>' +
    bindings(r.policies) +
    '<p><code>read_only</code> enables Code Mode’s read-only restrictions. <code>default</code> uses its normal policy; existing permission checks still apply.</p></details><h4>Adding a new name</h4><p>Register new bindings in the Seer workflow runtime.</p>'
  );
}
function helpPage(topic) {
  const env = labConfig?.environment || {},
    db = esc(env.database || 'seer'),
    keep = env.keep_proof_data;
  if (topic === 'parity') {
    return (
      '<h3>Workflow behavior and limits</h3><ul>' +
      labConfig.workflow_notes.map(note => '<li>' + esc(note) + '</li>').join('') +
      '</ul>'
    );
  }
  if (topic === 'skills') {
    return (
      '<h3>Investigation skills</h3><p>Each workflow keeps its prompts in its own skills directory. The breached_metrics workflow selects them by names such as <code>breached-metrics/broad-scan</code>.</p>' +
      Object.entries(labConfig.registry.skills)
        .map(
          ([name, text]) =>
            '<details><summary>' +
            esc(name) +
            '</summary><pre>' +
            esc(text) +
            '</pre></details>'
        )
        .join('')
    );
  }
  if (topic === 'start') {
    return '<h3>Investigate a breached metric monitor</h3><p>This Lab runs the new durable workflow runner and Explorer against your local backend. The example is loaded from a database seed and uses registered skills and Pydantic schemas.</p><ol><li>Load <b>Examples → Breached metric monitor</b>.</li><li>In <b>Workflow input</b>, replace the sample project and detector IDs and incident/baseline windows with your monitor’s values. No telemetry is seeded by this example.</li><li>Choose <b>Live investigation</b> and press Run. This makes real model and tool calls.</li><li>Switch to Graph. Broad scan produces 1–4 hypotheses. Each gets a coordinator/verifier loop, with arrows in both directions. The coordinator can revise, skip, reorder, and add checks through its typed state, for up to 12 turns.</li><li>After all verifiers finish, the judge evaluates each hypothesis separately. The example sets <code>notebook: true</code>. Once all steps finish, the writer receives the full workflow data. The run returns the notebook receipt after metadata and next steps are saved. Set <code>notebook: false</code> to return the judgments directly.</li></ol><p>Read <b>Workflow behavior</b> for the execution policy and current limits.</p><h4>Test a crash without model calls</h4><p>Keep the same example loaded. Choose a recovery scenario from the Run menu. The Lab isolates its broad-scan node and supplies the <b>Simulated output</b> artifact. Workflow and Explorer rows are real; no model or tools are called. Recovery checks and the session log explain what was verified.</p>';
  }

  if (topic === 'modes') {
    return (
      '<h3>Choose a scenario from the Run menu</h3><p>You do not add crash settings to your workflow JSON. Keep the breached-monitor example loaded, choose a failure point from the arrow beside Run, then press Run. Each run isolates the first agent node (broad scan in this example) and starts a fresh case using the current input and simulated artifact.</p><p>To vary a case, edit the instructions or Workflow input; for a recovery test, also edit Simulated output to match your output schema. Creating a new kind of injected failure requires changing the local harness in <code>workflow_debug.py</code>.</p>' +
      Object.entries(cases)
        .map(
          ([id, c]) =>
            '<section class="scenario-card"><h4>' +
            esc(c.label) +
            '</h4><p>' +
            esc(c.description) +
            '</p><p><b>What the lab does:</b> ' +
            esc(c.how) +
            '</p><p><b>Expected result:</b> ' +
            esc(c.expect) +
            '</p><button data-choose-scenario="' +
            esc(id) +
            '">Select this mode</button></section>'
        )
        .join('') +
      '<div class="help-callout">Recovery tests inject exceptions or drop messages; they do not kill your running dev server. The lab advances saved lease and retry deadlines, so you do not wait real production intervals.</div>'
    );
  }
  if (topic === 'checks') {
    return (
      '<h3>What does a green check mean?</h3><p>A check is a runtime assertion in the lab harness. It inspects database state or records what the simulated agent did, then reports whether the scenario behaved as expected. Checks are not model evaluations and do not judge answer quality.</p>' +
      tableRows([
        [
          'Saved in Postgres',
          'Workflow definitions, workflow runs, node state, and Explorer child state. A node’s status, output, attempt, lease, and scheduling deadlines are real database fields.',
        ],
        [
          'Saved in this session and log',
          'The pass/fail checklist, agent invocation counts, queued delivery counts, and before/after checkpoint snapshots. These are not their own database tables or columns.',
        ],
        [
          'What a failure means',
          'At least one assertion failed, or preparation/execution raised an error. Open Activity and the Session log for the failing boundary. A node may have reached succeeded before a later lab assertion failed.',
        ],
      ]) +
      '<h4>Words used in these checks</h4>' +
      tableRows([
        ['Workflow run', 'One execution of your saved workflow definition.'],
        [
          'Node run',
          'The saved progress of one workflow node, including its input, output, errors, and retry attempt.',
        ],
        ['Explorer child', 'The persisted Explorer agent run linked to that node.'],
        [
          'Attempt',
          'An intentional try at executing the node. Recovery stays on the same attempt. A retry after a timeout starts another attempt.',
        ],
        [
          'Claim / lease',
          'A temporary database record saying which worker owns the node and when that ownership expires.',
        ],
        [
          'Reconciliation',
          'A short backend pass that reads saved state, starts or finds the child, and saves completion.',
        ],
        [
          'Recovery sweep',
          'The backend scan that finds due work and queues reconciliation. The lab invokes it directly.',
        ],
        [
          'Dispatch / delivery',
          'Sending a task to be executed. A task can be delivered more than once; the execution guard must prevent duplicate work.',
        ],
      ]) +
      '<h4>What is real in a recovery test?</h4><p>The workflow validators, durable runner, Explorer child creation, database transactions, execution guard, and result validation are real Seer code. The model response is simulated, and queue publishing is captured in the test process instead of sent through Celery.</p><p>The lab exercises recovery without the original caller context, using the context saved with the accepted run. This proves these controlled failure boundaries; it is not a test of a real broker outage or a guarantee of exactly-once external tool side effects.</p><h4>One child per attempt</h4><p>Most cases must finish with attempt <code>1</code>, one child row, and one agent invocation. The timeout retry case expects attempt <code>2</code> and two children. Extra queued deliveries are allowed if they do not invoke the same agent step again.</p>'
    );
  }
  if (topic === 'fields') {
    return (
      '<h3>Workflow JSON field guide</h3>' +
      registeredNamesGuide() +
      '<h4>Top-level workflow fields</h4>' +
      tableRows(
        [
          'schema_version',
          'name',
          'version',
          'input_schema',
          'nodes',
          'output',
          'notebook',
        ].map(k => ['<code>' + k + '</code>', esc(fieldHelp[k])])
      ) +
      '<h4>Fields inside your agent node</h4>' +
      tableRows(
        [
          'kind',
          'instructions',
          'skills',
          'input',
          'input_schema',
          'output_schema',
          'model_alias',
          'max_iterations',
          'code_mode_policy',
          'enable_bash_mode',
          'enable_coding',
        ].map(k => ['<code>' + k + '</code>', esc(fieldHelp[k])])
      ) +
      '<h4>Additional fields for direct LLM nodes</h4><p>LLM nodes share instructions, skills, typed inputs/outputs, and model_alias. They return one structured response without tools, sandbox access, streaming, or agent iterations.</p>' +
      tableRows(
        [
          'max_tokens',
          'timeout_seconds',
          'instructions_role',
          'temperature',
          'seed',
          'reasoning_effort',
          'thinking_budget',
        ].map(k => ['<code>' + k + '</code>', esc(fieldHelp[k])])
      ) +
      '<h4>The two data editors</h4><p><b>Workflow input</b> is data supplied to this run. For <code>BreachedMetricInput</code>, enter the real monitor, project IDs, and incident window. Supply queryWindows.incident and queryWindows.baseline explicitly; the runner passes them unchanged. The node’s <code>input</code> binding decides how to pass it to the agent.</p><p><b>Simulated output</b> is the agent response used only by recovery tests. Recovery tests isolate broad scan, so the simulated response must match <code>BroadScanArtifact</code>: a summary and 1–4 hypotheses, each with a verification plan. To change the output shape, register another Pydantic model and update <code>output_schema</code>.</p><div class="help-callout">Code Mode permissions and sandbox access are separate controls. A read-only Code Mode policy does not make bash or coding read-only. The existing runtime enforces each mode’s own permissions and prerequisites.</div><h4>Map nodes</h4><p><code>items</code> references a list. <code>$item</code> binds one value into each agent’s input. <code>max_concurrency</code> limits simultaneous item agents, within the four-agent run limit. Collections are saved once and limited to 100 items. Results preserve input order. An empty map returns <code>[]</code>.</p><p>' +
      esc(fieldHelp.failure_policy) +
      '</p><h4>Loops and nested maps</h4><p><code>map.body</code> is the node to repeat for each <code>$item</code>. It can be an <code>agent_loop</code> with a <code>coordinator</code> and <code>worker</code>, each an agent or llm definition. This example uses a direct LLM coordinator and an Explorer worker. The coordinator reads <code>$loop</code>: the original input, saved state, completed worker history, current round, and maximum rounds. Its output specializes <code>LoopDecision[State, WorkerInput, Result]</code>. The coordinator maintains its typed plan and returns run or finish directly. There is no workflow-specific Python decision adapter. A <code>run</code> decision supplies one worker input through <code>$decision.input</code>; a <code>finish</code> decision returns the loop result. <code>initial_state</code> is validated against <code>state_schema</code>. Each round is saved separately and returns to the coordinator after the worker finishes or exhausts its retries. The final allowed coordinator round must finish. <code>min_worker_runs</code> defaults to 0; this example sets it to 1. Finishing before that many worker executions have settled fails the loop, and retries count as one worker execution. Graph view shows arrows in both directions; expand a card to inspect all saved rounds.</p>'
    );
  }
  if (topic === 'results') {
    return (
      '<h3>Tabs and controls</h3>' +
      tableRows([
        [
          'Workflow',
          'The editable workflow definition and two data editors. Your drafts stay in this browser.',
        ],
        [
          'Activity',
          esc(viewNotes.activity) +
            ' Live response text appears automatically as Explorer saves it. The Lab uses Explorer’s interactive mode for streaming; if the agent asks a question, the run pauses. Replies are not supported in this Lab yet.',
        ],
        ['Output', esc(viewNotes.output)],
        ['Run details', esc(viewNotes.state)],
        [
          'Model usage',
          esc(viewNotes.usage) +
            ' Actual model names include fallbacks only if they were used. Costs are recorded estimates, not invoices. Cache and reasoning tokens follow provider accounting.',
        ],
        [
          'Recovery checks',
          esc(viewNotes.proof) + ' Each check includes its own explanation.',
        ],
      ]) +
      '<h4>Editor and run controls</h4>' +
      tableRows([
        [
          'JSON / Graph',
          'Switch between editing JSON and a dependency flowchart. Click a node to expand instructions, settings, received input, every saved attempt, agent turns, tool calls/results, errors, and final output. Blue means running; green succeeded; red terminal failure; yellow retry scheduled. Animated dotted connections lead into a running node. Tokens and recorded costs include all attempts. Editing the definition switches to a preview without old run data.',
        ],
        [
          'Clear run',
          'Clear displayed results, activity, errors, elapsed time, and graph progress. Keeps workflow/input drafts and database rows. Finish or stop an active run first.',
        ],
        [
          'Errors',
          'Appears beside Workflow input when errors occur. Expand each error to inspect and copy its recorded stack trace. Errors without a recorded trace offer Copy error. Drag the divider above these tabs to resize the panel.',
        ],
        [
          'Format',
          'Reindent the workflow JSON without changing its meaning. Does not format the input editors or run anything.',
        ],
        [
          'Validate',
          'Check workflow fields, input/reference types, registry bindings, and supported Explorer settings. In recovery mode, also validate Simulated output. Does not verify cloud credentials, call a model, or create workflow rows.',
        ],
        [
          'Run + arrow',
          'Choose a mode with the arrow; start it with Run or Ctrl/Cmd+Enter. Only one run can be active in this lab process at a time.',
        ],
        [
          'Stop',
          'Cancel the investigation and ask all active agents to stop after their current iteration. This is not a simulated crash. Available for running or paused investigations; disabled for recovery tests and finished investigations.',
        ],
        [
          'Layout buttons',
          'Show one pane, side by side, or stacked. These only change the view. Resize the divider by dragging or using arrow keys.',
        ],
        [
          'Elapsed time',
          'Wall-clock duration of this lab run. Test deadlines are advanced explicitly, so this is not a production recovery-time benchmark.',
        ],
        [
          'Session log',
          'Download JSON-lines events, errors, checks, and usage for this server session. Old log files remain after restart.',
        ],
        [
          'Settings',
          'Attempts per node, active caller/database/project information, retention policy, and the session log. Registered names and their definitions are in Field guide.',
        ],
        [
          'Help & guide',
          'This guide. Hover controls or focus them with Tab for custom tooltips; Escape dismisses a tooltip. F1 opens help.',
        ],
      ]) +
      '<h4>Run status</h4><p><b>Preparing</b>: validating and constructing the request. <b>Running</b>: execution or recovery is in progress. <b>Succeeded</b>: this mode completed and its output validated. <b>Failed</b>: inspect the error and Activity. <b>Awaiting input</b>: Explorer paused; this lab cannot submit the response yet.</p><p>The status of a recovery test is a lab outcome. Its checkpoint separately shows the stored workflow and node statuses.</p>'
    );
  }
  if (topic === 'storage') {
    return '<h3>Where does the data go?</h3><p>Live runs use the configured Seer database and standard workflow workers. Notebook blocks and metadata are stored in the Sentry organization. Recovery simulations create a temporary schema in local Seer Postgres. The Checks tab shows its name and a read-only query.</p>';
  }
  return '<h3>Run Workflow Lab locally</h3><p>Start the Sentry development web and asset servers, and the Seer API and workflow workers. Sign in to Sentry and open <code>/workflow-lab/&lt;org-slug&gt;/</code>. The session supplies the actor and organization for the signed workflow request.</p><p>If a live run remains pending, check the Seer workers. For a recovery simulation, set <code>WORKFLOW_LAB_SEER_CHECKOUT</code> on the Sentry server to your local Seer checkout.</p>';
}
function showHelp(topic = 'start') {
  hideTooltip();
  if ($('settingsDialog').open) {
    $('settingsDialog').close();
  }
  helpTopic = topic;
  $('helpContent').innerHTML = helpPage(topic);
  $('helpContent').setAttribute('aria-labelledby', 'help-' + topic);
  $('helpContent').scrollTop = 0;
  document.querySelectorAll('[data-topic]').forEach(b => {
    b.classList.toggle('active', b.dataset.topic === topic);
    b.setAttribute('aria-selected', String(b.dataset.topic === topic));
    b.setAttribute('aria-controls', 'helpContent');
  });
  if (!$('helpDialog').open) {
    $('helpDialog').showModal();
  }
}
function hideTooltip() {
  clearTimeout(tipTimer);
  $('labTooltip').hidden = true;
  if (tooltipOwner) {
    tooltipOwner.removeAttribute('aria-describedby');
    tooltipOwner = null;
  }
}
function tipTarget(target) {
  if (!(target instanceof Element)) {
    return null;
  }
  const property = target.closest('.cm-property');
  if (property) {
    const key = property.textContent.replace(/^"|"$/g, '');
    if (fieldHelp[key]) {
      property.dataset.tipTitle = key;
      property.dataset.tipText = fieldHelp[key];
      return property;
    }
  }
  return target.closest('[data-tip],[data-tip-text]');
}
function showTooltip(owner) {
  if (!owner?.isConnected) {
    return;
  }
  hideTooltip();
  const info = owner.dataset.tipText
    ? [owner.dataset.tipTitle || 'About this control', owner.dataset.tipText]
    : tips[owner.dataset.tip];
  if (!info) {
    return;
  }
  const box = $('labTooltip'),
    dialog = owner.closest('dialog');
  (dialog || document.body).appendChild(box);
  box.innerHTML = '<strong>' + esc(info[0]) + '</strong>' + esc(info[1]);
  box.hidden = false;
  box.style.left = '0px';
  box.style.top = '0px';
  const r = owner.getBoundingClientRect(),
    b = box.getBoundingClientRect();
  let x = Math.max(12, Math.min(r.left, innerWidth - b.width - 12)),
    y = r.bottom + 9;
  if (y + b.height > innerHeight - 12) {
    y = Math.max(12, r.top - b.height - 9);
  }
  box.style.left = x + 'px';
  box.style.top = y + 'px';
  owner.setAttribute('aria-describedby', 'labTooltip');
  tooltipOwner = owner;
}
document.addEventListener('pointerover', e => {
  const owner = tipTarget(e.target);
  if (owner && owner !== tooltipOwner) {
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => showTooltip(owner), 350);
  }
});
document.addEventListener('pointerout', e => {
  const owner = tipTarget(e.target);
  if (owner && !owner.contains(e.relatedTarget)) {
    hideTooltip();
  }
});
document.addEventListener('focusin', e => {
  const owner = tipTarget(e.target);
  if (owner) {
    showTooltip(owner);
  }
});
document.addEventListener('focusout', () => hideTooltip());
document.addEventListener('scroll', () => hideTooltip(), true);
document.addEventListener('click', e => {
  const help = e.target.closest('[data-help-topic]');
  if (help) {
    showHelp(help.dataset.helpTopic);
  }
  const topic = e.target.closest('[data-topic]');
  if (topic) {
    showHelp(topic.dataset.topic);
  }
  const choose = e.target.closest('[data-choose-scenario]');
  if (choose && setScenario(choose.dataset.chooseScenario)) {
    $('helpDialog').close();
    message('Mode selected. Review your inputs, then press Run.');
  }
  if (e.target.closest('[data-copy-sql]')) {
    copyProofSQL(e.target.closest('[data-copy-sql]'));
  }
});
document.addEventListener('keydown', e => {
  if (e.key === 'F1') {
    e.preventDefault();
    showHelp();
  }
  if (e.key === 'Escape' && !$('labTooltip').hidden) {
    e.preventDefault();
    e.stopPropagation();
    hideTooltip();
  }
});
$('help').onclick = () => showHelp();
$('closeHelp').onclick = () => $('helpDialog').close();
for (const id of ['helpDialog', 'settingsDialog']) {
  $(id).addEventListener('close', () => hideTooltip());
}
function proofSQL() {
  const schema = lastSnapshot?.proof?.checkpoint?.schema;
  if (!/^workflow_debug_[a-f0-9]+$/.test(schema || '')) {
    return '';
  }
  return (
    "SELECT r.id AS workflow_run_id, r.status AS workflow_status,\n       n.id AS node_run_id, n.status AS node_status, n.attempt,\n       n.explorer_run_id, n.next_check_at, n.lease_token,\n       n.state->'output' AS output,\n       (SELECT count(*) FROM " +
    schema +
    ".run_state c\n        WHERE c.type = 'explorer'\n          AND c.value->'metadata'->>'workflow_node_run_id' = n.id::text) AS explorer_children\nFROM " +
    schema +
    '.investigation_workflow_node_runs n\nJOIN ' +
    schema +
    '.investigation_workflow_runs r ON r.id = n.workflow_run_id;'
  );
}
async function copyProofSQL(button) {
  try {
    await navigator.clipboard.writeText(proofSQL());
    button.textContent = 'Query copied';
    message('Read-only query copied. Paste it into TablePlus.');
  } catch {
    message('Could not copy. Expand the query below and copy its text.', true);
  }
}
function refreshContextHelp() {
  const c = cases[scenario] || {};
  $('contextHelp').dataset.tipText =
    (c.description || 'Choose a run scenario.') +
    ' ' +
    (viewNotes[view] || '') +
    ' Graph: blue = running, green = succeeded, red = terminal failure, yellow = retry scheduled. Click a node for its settings, received input, all saved agent turns and tool calls, errors, and final output. Tokens and cost include all attempts; — means usage has not been reported.';
}
$('contextHelp').onclick = () => showTooltip($('contextHelp'));
function refreshMode() {
  $('fixtureTab').classList.toggle('hidden', scenario === 'agent');
  const c = cases[scenario];
  if (!c) {
    return;
  }
  refreshContextHelp();
  $('modeLabel').textContent =
    scenario === 'agent' ? 'Live investigation' : 'Recovery test';
  $('modeLabel').dataset.tipTitle = c.label;
  $('modeLabel').dataset.tipText = c.how + ' Expected: ' + c.expect;
}
function configureGuide(c) {
  labConfig = c;
  const env = c.environment || {};
  for (const id of [
    'workflowTab',
    'resultsTab',
    'tabsOnly',
    'splitRight',
    'splitDown',
    'splitter',
    'timer',
    'stop',
    'run',
    'runMenuToggle',
    'settings',
    'format',
    'validate',
    'inputTab',
    'fixtureTab',
    'identity',
    'editorStatus',
  ]) {
    $(id).dataset.tip = id;
  }
  $('runStatus').dataset.tip = 'status';
  document.querySelectorAll('[data-view]').forEach(b => {
    b.dataset.tip = b.dataset.view;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', String(b.dataset.view === view));
  });
  const fields = [
    ['Sentry organization', env.organization_id],
    ['Caller', env.actor_type + ' ' + env.actor_id],
    ['Workflow service', 'Seer'],
    [
      'Recovery test rows',
      env.keep_proof_data ? 'Kept after completion' : 'Removed after completion',
    ],
  ];
  $('environmentDetails').innerHTML = fields
    .map(([k, v]) => '<dt>' + esc(k) + '</dt><dd>' + esc(v) + '</dd>')
    .join('');
  $('retentionNote').textContent = env.keep_proof_data
    ? 'Retention is enabled by WORKFLOW_LAB_KEEP_PROOF_DATA=1. Refresh TablePlus schemas after a recovery test to find its workflow_debug_… schema.'
    : 'To keep test rows for TablePlus, start the Sentry server with WORKFLOW_LAB_KEEP_PROOF_DATA=1. This cannot be changed by workflow JSON.';
  refreshMode();
}

(async () => {
  const c = await requestJSON('editor/');
  cases = c.scenarios;
  configureGuide(c);
  $('logPath').textContent = 'Current browser session';
  restoreDraft(c);
  $('exampleMenu').innerHTML =
    '<div class="menu-title">Load into the workflow and input editors</div>' +
    Object.entries(c.examples)
      .map(
        ([id, x]) =>
          '<button role="menuitem" data-example="' +
          esc(id) +
          '">' +
          esc(x.label) +
          '<small>' +
          esc(x.description) +
          '</small></button>'
      )
      .join('');
  setEditor('fixture', fmt(c.fixture));
  $('identity').textContent = c.identity;
  $('runMenu').innerHTML =
    '<div class="menu-title">Choose a mode, then press Run</div>' +
    Object.entries(cases)
      .map(
        ([id, x], i) =>
          (i === 1
            ? '<hr><div class="menu-title">Recovery tests · simulated response</div>'
            : '') +
          `<button role="menuitem" data-scenario="${esc(id)}" data-tip-title="${esc(x.label)}" data-tip-text="${esc(x.how + ' Expected: ' + x.expect)}" class="${id === 'agent' ? 'selected' : ''}">${id === 'agent' ? '▷' : '↻'} ${esc(x.label)}<small>${esc(x.description)}</small></button>`
      )
      .join('');
  for (const b of document.querySelectorAll('[data-scenario]')) {
    b.onclick = () => setScenario(b.dataset.scenario);
  }
  layout = storage.getItem('workflow-debug-layout') || 'split-right';
  applyLayout();
  setEditorMode(editorMode);
  renderMetrics(null);
  refreshMode();
  const previous = storage.getItem('workflow-debug-run');
  if (previous) {
    const saved = await getRun(previous).catch(() => null);
    if (saved) {
      runId = previous;
      setScenario(saved.scenario || 'agent');
      render(saved);
      if (!lastSnapshot.done) {
        $('run').disabled = true;
        $('runMenuToggle').disabled = true;
        $('clearRun').disabled = true;
        connect(previous);
      }
    }
  }
})().catch(e => message(e, true));

document.querySelectorAll('[data-download-log]').forEach(link =>
  link.addEventListener('click', () => {
    const url = URL.createObjectURL(
      new Blob([JSON.stringify({run: lastSnapshot, errors: errors.entries}, null, 2)], {
        type: 'application/json',
      })
    );
    link.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  })
);
