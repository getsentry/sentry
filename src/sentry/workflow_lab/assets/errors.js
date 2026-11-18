import {WorkflowActivity} from './activity.js';
/* eslint-disable boundaries/no-unknown-files -- This standalone Django page serves its JavaScript independently of the Sentry application. */
export class WorkflowErrors {
  constructor(element, tab) {
    this.element = element;
    this.tab = tab;
    this.entries = [];
    element.addEventListener('click', async event => {
      const button = event.target.closest('[data-copy-error]');
      if (!button) {
        return;
      }
      const error = this.entries[Number(button.dataset.copyError)];
      try {
        await navigator.clipboard.writeText(error.trace || error.message);
        button.textContent = 'Copied';
      } catch {
        button.textContent = 'Select and copy the text below';
      }
    });
  }

  add(value, source = 'Lab') {
    if (!value) {
      return false;
    }
    const detail =
      typeof value === 'string' ? value : value.message || value.error || value;
    const message = typeof detail === 'string' ? detail : JSON.stringify(detail, null, 2);
    const trace = value.traceback || value.stack_trace || value.stack || '';
    const existing = this.entries.find(
      error => error.source === source && error.message === message
    );
    if (existing && (!trace || existing.trace === trace)) {
      return false;
    }
    if (existing) {
      existing.trace = trace;
    } else {
      this.entries.push({
        source,
        message,
        trace,
        time: new Date().toLocaleTimeString('en-GB'),
      });
    }
    this.render();
    return true;
  }

  capture(snapshot) {
    for (const event of snapshot.events || []) {
      const data = event.data;
      if (data?.traceback) {
        this.add(
          {
            message: data.message || data.error || event.message,
            traceback: data.traceback,
          },
          event.message
        );
      }
    }
    const captureNode = (name, node) => {
      const source = name + (node.attempt ? ' · attempt ' + node.attempt : '');
      if (node.error) {
        this.add(node.error, source);
      }
      for (const item of node.items || []) {
        captureNode(`${name}[${item.item_index + 1}]`, item);
      }
    };
    for (const [name, node] of Object.entries(snapshot.nodes || {})) {
      captureNode(name, node);
    }
    const message =
      typeof snapshot.error === 'string' ? snapshot.error : snapshot.error?.message;
    if (message && !this.entries.some(error => error.message === message)) {
      this.add(snapshot.error, 'Investigation');
    }
  }

  clear() {
    this.entries = [];
    this.render();
  }

  render() {
    const escapeText = WorkflowActivity.escape;
    const open = new Set(
      Array.from(
        this.element.querySelectorAll('details[open]'),
        detail => detail.dataset.error
      )
    );
    this.tab.classList.toggle('hidden', !this.entries.length);
    this.tab.textContent = `ERRORS (${this.entries.length})`;
    this.element.innerHTML = this.entries
      .map(
        (error, index) =>
          `<details class="lab-error" data-error="${index}" ${open.has(String(index)) ? 'open' : ''}>` +
          '<summary><svg class="lab-error-chevron" viewBox="0 0 10 10" aria-hidden="true"><path d="m3 1 4 4-4 4"/></svg>' +
          '<span class="lab-error-severity" aria-label="Error">×</span>' +
          `<time data-tip-title="First seen" data-tip-text="When this error first appeared in this Lab view.">${escapeText(error.time)}</time>` +
          `<span class="lab-error-message">${escapeText(error.message.split('\n')[0])}</span><span class="lab-error-source" data-tip-title="Error source" data-tip-text="${escapeText(error.source)}">${escapeText(error.source)}</span></summary>` +
          `<div class="lab-error-body"><div class="lab-error-actions"><span>${error.trace ? 'Stack trace' : 'Error details'}</span><button data-copy-error="${index}"><svg class="toolbar-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>${error.trace ? 'Copy stack trace' : 'Copy error'}</button></div>` +
          `<pre>${escapeText(error.trace || error.message)}</pre>` +
          (error.trace
            ? ''
            : '<p class="note">No stack trace was recorded for this error.</p>') +
          '</div></details>'
      )
      .join('');
  }
}
