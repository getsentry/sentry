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
