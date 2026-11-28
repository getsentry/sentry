/* eslint-disable boundaries/no-unknown-files, @typescript-eslint/no-extraneous-class -- This standalone Django page serves its JavaScript independently of the Sentry application. */
import {workflowSteps} from './transport.js';

/* Render the same Explorer activity in the timeline and expanded graph cards. */
const activityMarkdown = window.markdownit({html: false}).disable('image');
export class WorkflowActivity {
  static escape(value) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      char =>
        ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char]
    );
  }

  static json(value) {
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        /* This block contains plain text. */
      }
    }
    return (
      '<pre class="activity-json"><code>' +
      this.escape(typeof value === 'string' ? value : JSON.stringify(value, null, 2)) +
      '</code></pre>'
    );
  }

  static message(block) {
    if (!block.message?.content) {
      return '';
    }
    try {
      const value = JSON.parse(block.message.content);
      if (value && typeof value === 'object') {
        return this.json(value);
      }
    } catch {
      /* This block contains plain text. */
    }
    return (
      '<div class="agent-markdown">' +
      activityMarkdown.render(block.message.content) +
      '</div>'
    );
  }

  static timeline(snapshot) {
    const entries = (snapshot.events || []).map((event, index) => ({
      id: 'Run',
      key: ['event', index],
      timestamp: event.timestamp,
      event,
    }));
    for (const {id, node} of workflowSteps(snapshot.nodes)) {
      const attempts = node.attempts?.length
        ? node.attempts
        : [{explorer_run_id: node.explorer_run_id, session: node.session}];
      attempts.forEach((attempt, index) => {
        (attempt.session?.blocks || []).forEach((block, turn) =>
          entries.push({
            id,
            key: [id, attempt.explorer_run_id, block.id ?? turn],
            timestamp: block.timestamp,
            attempt:
              attempt.attempt > 1
                ? attempt.attempt
                : attempts.length > 1
                  ? index + 1
                  : null,
            block,
          })
        );
      });
    }
    return entries.sort(
      (a, b) => (Date.parse(a.timestamp) || 0) - (Date.parse(b.timestamp) || 0)
    );
  }

  static feed(snapshot) {
    return this.timeline(snapshot)
      .map(({id, key, timestamp, attempt, block, event}) => {
        const section = (title, content, name) =>
          `<details data-activity-key="${this.escape(JSON.stringify([snapshot.id, ...key, name]))}"><summary>${this.escape(title)}</summary>${content}</details>`;
        const time = Date.parse(timestamp);
        const clock = Number.isFinite(time)
          ? new Date(time).toLocaleTimeString([], {hour12: false})
          : event?.at || '';
        const header =
          `<div class="activity-meta"><span class="activity-tag">${this.escape(id)}</span><span>${this.escape(event ? 'Event' : block.message?.role || 'Message')}</span>` +
          (attempt ? `<span>Attempt ${attempt}</span>` : '') +
          `<time title="${this.escape(timestamp || '')}">${this.escape(clock)}</time></div>`;
        const content = event
          ? '<div class="activity-text">' +
            this.escape(event.message) +
            '</div>' +
            (event.data === null || event.data === undefined
              ? ''
              : section('Details', this.json(event.data), 'data'))
          : this.message(block) +
            this.tools(block, section) +
            (block.artifacts || [])
              .map(
                artifact =>
                  '<div class="activity-output-label">' +
                  this.escape(
                    artifact.key === 'workflow_node_result'
                      ? 'Node result · JSON'
                      : artifact.key
                  ) +
                  '</div>' +
                  this.json(artifact.data)
              )
              .join('');
        return `<article class="activity-entry${block?.loading ? ' loading' : ''}">${header}${content}</article>`;
      })
      .join('');
  }

  static render(element, snapshot) {
    const markup = this.feed(snapshot);
    if (element.activityMarkup === markup && element.childElementCount) {
      return;
    }
    const expanded = new Map(
      Array.from(element.querySelectorAll('details[data-activity-key]'), detail => [
        detail.dataset.activityKey,
        detail.open,
      ])
    );
    for (const editor of element.activityEditors || []) {
      editor.toTextArea();
    }
    element.activityEditors = [];
    element.activityMarkup = markup;
    element.innerHTML = markup;
    for (const detail of element.querySelectorAll('details[data-activity-key]')) {
      if (expanded.has(detail.dataset.activityKey)) {
        detail.open = expanded.get(detail.dataset.activityKey);
      }
    }
    this.refreshCode(element);
  }

  static refreshCode(element) {
    if (window.CodeMirror === undefined) {
      return;
    }
    element.activityEditors ||= [];
    for (const pre of element.querySelectorAll(
      'pre.activity-json, .agent-markdown pre:not(.CodeMirror-line):not(.CodeMirror-line-like)'
    )) {
      if (!pre.getClientRects().length || pre.closest('.CodeMirror')) {
        continue;
      }
      const value = pre.textContent;
      let mode = null;
      try {
        JSON.parse(value);
        mode = {name: 'javascript', json: true};
      } catch {
        /* This block contains plain text. */
      }
      const wrapper = document.createElement('div');
      wrapper.className = 'activity-code';
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.readOnly = true;
      textarea.setAttribute(
        'aria-label',
        mode ? 'JSON output, read only' : 'Code output, read only'
      );
      wrapper.append(textarea);
      pre.replaceWith(wrapper);
      element.activityEditors.push(
        window.CodeMirror.fromTextArea(textarea, {
          value,
          mode,
          theme: 'sentry-dark',
          lineNumbers: true,
          lineWrapping: true,
          readOnly: true,
          viewportMargin: Infinity,
          indentUnit: 2,
          tabSize: 2,
        })
      );
    }
    for (const editor of element.activityEditors) {
      editor.refresh();
    }
  }

  static callGroups(block) {
    const results = new Map(
      (block.tool_results || []).map(result => [result.tool_call_id, result])
    );
    const calls = block.message?.tool_calls || [];
    const pending = calls.filter(call => call.id && !results.has(call.id));
    return calls.map(call => {
      const result = results.get(call.id);
      // Explorer's live records belong to the block, so only a lone pending call can own them.
      const records = result
        ? result.structuredContent?.calls || []
        : pending.length === 1 && pending[0].id === call.id
          ? block.live_calls || []
          : [];
      return {
        call,
        result,
        records,
        progress: result
          ? []
          : (block.progress || []).filter(
              event => event.token === call.id && event.message
            ),
      };
    });
  }

  static tools(
    block,
    section = (title, content) =>
      `<details><summary>${this.escape(title)}</summary>${content}</details>`
  ) {
    return this.callGroups(block)
      .map(({call, result, records, progress}) => {
        const codeMode = ['sentry_api_execute', 'sentry_api_search'].includes(
          call.function
        );
        const label =
          call.function === 'artifact_write_workflow_node_result'
            ? 'Save node result'
            : codeMode
              ? 'Code Mode'
              : call.function.replace(/^artifact_write_/, 'Save artifact: ');
        const activity = records
          .map(record => {
            const status =
              record.error || record.status >= 400
                ? 'failed'
                : result || (record.status !== null && record.status !== undefined)
                  ? 'completed'
                  : 'running';
            const title =
              record.llm_description ||
              record.title ||
              record.name ||
              [record.method, record.path].filter(Boolean).join(' ') ||
              'API call';
            const request = [
              record.method,
              record.resolved_path || record.path || record.name,
            ]
              .filter(Boolean)
              .join(' ');
            return (
              `<div class="tool-activity ${status}"><span class="tool-state">${status === 'failed' ? '×' : status === 'completed' ? '✓' : '◌'} ${status}</span><strong>${this.escape(title)}</strong>` +
              (request ? '<code>' + this.escape(request) + '</code>' : '') +
              (record.error
                ? '<p class="error">' + this.escape(record.error) + '</p>'
                : '') +
              section(
                'Call details · ' + record.id,
                this.json(record),
                'record:' + call.id + ':' + record.id
              ) +
              '</div>'
            );
          })
          .join('');
        return (
          activity +
          progress
            .map(
              event => '<p class="tool-progress">' + this.escape(event.message) + '</p>'
            )
            .join('') +
          section(
            (codeMode && records.length ? 'Code and result' : label) +
              ' · ' +
              (result ? 'returned' : 'running'),
            '<div class="tool-name">' +
              this.escape(call.function) +
              '</div>' +
              this.json(call.args) +
              (result
                ? this.json(result)
                : '<p class="note">Waiting for the tool result.</p>'),
            'tool:' + call.id
          )
        );
      })
      .join('');
  }
}
