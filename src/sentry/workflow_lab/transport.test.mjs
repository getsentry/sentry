/* eslint-disable boundaries/no-unknown-files, eslint-js/no-restricted-syntax, import/no-nodejs-modules -- This is a Node test of the standalone Django frontend. */
import assert from 'node:assert/strict';
import {test} from 'node:test';

// This is the complete interface between the standalone shell and the notebook frame.
test('the active workflow owns the Notebook tab and the last read', async () => {
  let hidden;
  const pane = {
    replaceChildren(frame) {
      this.firstElementChild = frame;
    },
  };
  const context = {
    document: {
      documentElement: {dataset: {}},
      querySelectorAll: () => [],
      querySelector: () => ({classList: {toggle: (_, value) => (hidden = value)}}),
      getElementById: () => pane,
      createElement: () => ({
        getAttribute(name) {
          return this[name];
        },
      }),
    },
    view: 'notebook',
    lastSnapshot: {notebook: true, done: false, notebookId: null},
  };
  globalThis.document = context.document;
  const {syncNotebook} = await import('./assets/transport.js');
  syncNotebook(context.lastSnapshot, context.view);
  assert.equal(hidden, false);
  assert.match(pane.textContent, /Waiting/);
  context.lastSnapshot.notebookId = '42';
  syncNotebook(context.lastSnapshot, context.view);
  const live = pane.firstElementChild;
  assert.equal(live.src, 'notebook/?id=42&live=1');
  syncNotebook(context.lastSnapshot, context.view);
  assert.equal(pane.firstElementChild, live);
  context.lastSnapshot.done = true;
  syncNotebook(context.lastSnapshot, context.view);
  assert.equal(pane.firstElementChild.src, 'notebook/?id=42&live=0');
  context.view = 'output';
  syncNotebook(context.lastSnapshot, context.view);
  assert.equal(pane.firstElementChild, undefined);
  context.lastSnapshot = {notebook: false};
  syncNotebook(context.lastSnapshot, context.view);
  assert.equal(hidden, true);
});

test('run snapshots expand map items into independent coordinator and worker statuses', async t => {
  globalThis.document = {documentElement: {dataset: {}}};
  globalThis.window = {markdownit: () => ({disable() {}})};
  const {getRun} = await import('./assets/transport.js');
  const {WorkflowGraph} = await import('./assets/graph.js');
  const definition = {
    nodes: {
      verify: {
        kind: 'map',
        items: '$input.items',
        body: {
          kind: 'agent_loop',
          coordinator: {kind: 'llm'},
          worker: {kind: 'agent'},
        },
      },
    },
    output: '$verify',
  };
  const node = (id, status, fields = {}) => ({id, name: id, status, ...fields});
  const nodes = [
    node('verify', 'running'),
    node('notebook/write', 'pending', {kind: 'agent', dependencies: ['verify']}),
  ];
  for (const [i, status] of ['succeeded', 'running', 'ready'].entries()) {
    const parent = 'item-' + i;
    nodes.push(node(parent, 'running', {parent: 'verify', item: i}));
    nodes.push(node('c' + i, 'succeeded', {parent, role: 'coordinator', round: 1}));
    nodes.push(node('w' + i, status, {parent, role: 'worker', round: 1}));
  }
  const snapshot = {
    id: 'run',
    workflow: definition,
    nodes: nodes.toReversed(),
    usage: {usages: []},
  };
  t.mock.method(globalThis, 'fetch', () => Response.json(snapshot));
  const run = await getRun(snapshot.id);
  const graph = WorkflowGraph.prototype.displayGraph(
    definition,
    run.nodes,
    run.dependencies
  );
  assert.deepEqual(
    ['verify[1].worker', 'verify[2].worker', 'verify[3].worker'].map(
      id => graph.states[id].status
    ),
    ['succeeded', 'running', 'ready']
  );
  assert.equal(graph.states['verify[3].coordinator'].status, 'succeeded');
  assert.equal(graph.states['notebook/write'].status, 'pending');
  assert.equal(graph.dependencies['notebook/write'].length, 3);
});
