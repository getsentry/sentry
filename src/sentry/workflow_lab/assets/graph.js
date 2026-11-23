import {WorkflowActivity} from './activity.js';
/* eslint-disable boundaries/no-unknown-files, eslint-js/no-restricted-syntax, no-loop-func, no-shadow -- This standalone Django page serves its JavaScript independently of the Sentry application. */
/* Dependency preview and saved investigation activity. No execution logic lives here. */
export class WorkflowGraph {
  constructor(element) {
    this.element = element;
    this.expanded = new Set();
    this.sections = new Set();
    this.signature = '';
    this.zoom = null;
    element.addEventListener('click', event => {
      const zoom = event.target.closest('[data-graph-zoom]');
      if (zoom) {
        this.zoom =
          zoom.dataset.graphZoom === 'fit'
            ? null
            : Math.max(0.25, Math.min(1.5, this.scale * Number(zoom.dataset.graphZoom)));
        this.layout();
        return;
      }
      const button = event.target.closest('[data-expand-node]');
      if (!button) {
        return;
      }
      const id = button.dataset.expandNode;
      this.expanded.has(id) ? this.expanded.delete(id) : this.expanded.add(id);
      this.signature = '';
      this.render(...this.lastArgs);
      [...element.querySelectorAll('[data-expand-node]')]
        .find(b => b.dataset.expandNode === id)
        ?.focus();
    });
    element.addEventListener(
      'toggle',
      event => {
        const key = event.target.dataset.section;
        if (!key || !event.target.isConnected) {
          return;
        }
        event.target.open ? this.sections.add(key) : this.sections.delete(key);
        this.layout();
      },
      true
    );
    new ResizeObserver(() => this.layout()).observe(element);
  }

  escape(value) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      char =>
        ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'})[char]
    );
  }

  json(value) {
    return (
      '<pre>' +
      this.escape(typeof value === 'string' ? value : JSON.stringify(value, null, 2)) +
      '</pre>'
    );
  }

  section(id, title, content) {
    const key = id + ':' + title;
    return `<details data-section="${this.escape(key)}" ${this.sections.has(key) ? 'open' : ''}><summary>${this.escape(title)}</summary>${content}</details>`;
  }

  dependencies(definition) {
    const result = Object.create(null);
    const references = (value, found, scope) => {
      if (typeof value === 'string' && value.startsWith('$') && !value.startsWith('$$')) {
        const root = value.slice(1).split('.')[0];
        if (root !== 'input' && !scope.includes(root)) {
          found.add(root);
        }
      } else if (Array.isArray(value)) {
        value.forEach(item => references(item, found, scope));
      } else if (value && typeof value === 'object') {
        Object.values(value).forEach(item => references(item, found, scope));
      }
    };
    for (const [id, node] of Object.entries(definition.nodes)) {
      const found = new Set();
      const visit = (node, scope = []) => {
        if (node.kind === 'map') {
          references(node.items, found, scope);
          scope = [...scope, 'item'];
        }
        references(node.input, found, scope);
        references(node.initial_state, found, scope);
        if (node.body) {
          visit(node.body, scope);
        }
        if (node.kind === 'agent_loop') {
          visit(node.coordinator, [...scope, 'loop']);
          visit(node.worker, [...scope, 'loop', 'decision']);
        }
      };
      visit(node);
      result[id] = [...found];
    }
    return result;
  }

  displayGraph(definition, states, dependencies) {
    const nodes = Object.create(null),
      displayStates = Object.create(null),
      members = Object.create(null),
      edges = Object.create(null),
      loops = [];
    const expand = (id, node, state) => {
      if (node.kind === 'map' && state.items?.length) {
        const groups = state.items.map(item =>
          expand(`${id}[${item.item_index + 1}]`, node.body, {
            ...item,
            map_node_id: id,
            item_value: state.input?.[item.item_index],
          })
        );
        return {
          entry: groups.flatMap(group => group.entry),
          exit: groups.flatMap(group => group.exit),
        };
      }
      if (node.kind === 'map' && !state.items && !Array.isArray(state.input)) {
        return expand(`${id}[*]`, node.body, state);
      }
      if (node.kind === 'agent_loop') {
        const coordinator = `${id}.coordinator`,
          worker = `${id}.worker`;
        for (const role of ['coordinator', 'worker']) {
          const key = `${id}.${role}`,
            rounds = (state.children || [])
              .filter(child => child.role === role)
              .sort((a, b) => a.round - b.round);
          const latest = rounds.at(-1) || {};
          nodes[key] = node[role];
          displayStates[key] = {
            ...latest,
            round: latest.round || state.round,
            progress: state.progress,
            map_node_id: state.map_node_id,
            item_value: state.item_value,
            status:
              ['cancelled', 'failed'].includes(state.status) &&
              !['succeeded', 'failed'].includes(latest.status)
                ? state.status
                : latest.status || (state.status === 'succeeded' ? 'skipped' : 'pending'),
            attempts: rounds.flatMap(child =>
              (child.attempts || []).map(attempt => ({...attempt, round: child.round}))
            ),
            metrics: WorkflowGraph.aggregateMetrics(rounds),
          };
          edges[key] = [];
        }
        edges[worker] = [coordinator];
        loops.push({from: worker, to: coordinator});
        return {entry: [coordinator], exit: [worker]};
      }
      nodes[id] = node;
      displayStates[id] = state;
      edges[id] = [];
      return {entry: [id], exit: [id]};
    };
    for (const [id, node] of Object.entries(definition.nodes)) {
      members[id] = expand(id, node, states[id] || {});
    }
    // Notebook authoring and its post-run steps exist only in the execution graph.
    for (const [id, state] of Object.entries(states)) {
      if (!Object.hasOwn(members, id)) {
        members[id] = expand(id, {kind: state.kind}, state);
      }
    }
    for (const [id, group] of Object.entries(members)) {
      const parents = (dependencies[id] || []).flatMap(
        parent => members[parent]?.exit || [parent]
      );
      group.entry.forEach(child => edges[child].push(...parents));
    }
    return {nodes, states: displayStates, dependencies: edges, loops};
  }

  static aggregateMetrics(rounds) {
    const totals = {},
      models = [];
    for (const round of rounds) {
      for (const [key, value] of Object.entries(round.metrics?.totals || {})) {
        totals[key] = (totals[key] || 0) + value;
      }
      models.push(...(round.metrics?.models || []));
    }
    return {has_usage: rounds.some(round => round.metrics?.has_usage), totals, models};
  }

  trace(id, attempts) {
    if (!attempts?.length) {
      return '<p class="graph-empty">No saved activity yet.</p>';
    }
    return attempts
      .map((attempt, index) => {
        const session = attempt.session || {};
        const blocks = (session.blocks || [])
          .map((block, turn) => {
            const message = block.message || {};
            return (
              `<div class="graph-turn"><b>${this.escape(message.role || 'Turn')} · ${turn + 1}</b>` +
              WorkflowActivity.message(block) +
              WorkflowActivity.tools(block, (title, content) =>
                this.section(
                  id,
                  `Attempt ${index + 1} · turn ${turn + 1} · ${title}`,
                  content
                )
              ) +
              (block.artifacts?.length
                ? this.section(
                    id,
                    `Turn ${turn + 1} · artifacts`,
                    this.json(block.artifacts)
                  )
                : '') +
              '</div>'
            );
          })
          .join('');
        return (
          `<div class="graph-attempt"><b>${attempt.round ? `Round ${attempt.round} · ` : ''}Attempt ${attempt.attempt || index + 1} · ${attempt.kind === 'llm' ? 'LLM response' : 'Explorer ' + this.escape(attempt.explorer_run_id)}</b><span>${this.escape(session.status || '')}</span>` +
          (session.failure_reason
            ? '<p class="error">' + this.escape(session.failure_reason) + '</p>'
            : '') +
          (blocks || '<p class="graph-empty">Waiting for the first saved turn.</p>') +
          '</div>'
        );
      })
      .join('');
  }

  render(definition, states = {}, dependencies = null, saved = false) {
    this.lastArgs = [definition, states, dependencies, saved];
    const signature = JSON.stringify(this.lastArgs, (key, value) =>
      key === 'elapsed_ms' ? undefined : value
    );
    if (signature === this.signature) {
      return;
    }
    this.signature = signature;
    const escapeText = value => this.escape(value);
    try {
      if (!definition?.nodes || !Object.keys(definition.nodes).length) {
        throw new Error('Add nodes to the JSON definition to see the graph.');
      }
      const edges = this.dependencies(definition);
      for (const [id, parents] of Object.entries(dependencies || {})) {
        if (parents?.length) {
          edges[id] = parents;
        }
      }
      const display = this.displayGraph(definition, states, edges);
      this.dependenciesMap = display.dependencies;
      this.loops = display.loops;
      const depths = Object.create(null),
        visiting = new Set();
      const depth = id => {
        if (!Object.hasOwn(display.nodes, id)) {
          throw new Error(`Unknown dependency: ${id}. Check the JSON references.`);
        }
        if (visiting.has(id)) {
          throw new Error(
            'The workflow contains a dependency cycle. Fix it in JSON before running.'
          );
        }
        if (id in depths) {
          return depths[id];
        }
        visiting.add(id);
        const parents = this.dependenciesMap[id] || [];
        depths[id] = parents.length ? Math.max(...parents.map(depth)) + 1 : 0;
        visiting.delete(id);
        return depths[id];
      };
      const ids = Object.keys(display.nodes).sort((a, b) =>
        a.localeCompare(b, undefined, {numeric: true})
      );
      ids.forEach(depth);
      this.levels = [];
      ids.forEach(id => (this.levels[depths[id]] ||= []).push(id));
      this.states = display.states;
      const cards = ids
        .map(id => {
          const node = display.nodes[id],
            state = display.states[id],
            expanded = this.expanded.has(id);
          const status = state.status || 'pending';
          const labels = {
            pending: 'Waiting',
            skipped: 'Skipped',
            ready: 'Queued',
            running: 'Running',
            succeeded: 'Succeeded',
            failed: 'Failed',
            retrying: 'Retry scheduled',
            awaiting_input: 'Needs input',
            cancelled: 'Cancelled',
          };
          const metrics = state.metrics || {},
            totals = metrics.totals || {};
          const tokens = metrics.has_usage
            ? Number(totals.total_tokens).toLocaleString()
            : '—';
          const cost = metrics.has_usage
            ? '$' + Number(totals.dollar_cost).toFixed(6)
            : '—';
          let body = '';
          if (expanded) {
            body =
              '<div class="graph-node-body">' +
              (state.error
                ? '<div class="graph-error">' + this.json(state.error) + '</div>'
                : '') +
              (status === 'retrying' && state.next_check_at
                ? '<p class="graph-empty">Next attempt after ' +
                  escapeText(new Date(state.next_check_at).toLocaleTimeString()) +
                  '</p>'
                : '') +
              this.section(
                id,
                'Input received',
                state.input_resolved
                  ? this.json(state.input)
                  : '<p class="graph-empty">Resolved after dependencies succeed.</p>' +
                      this.json(node.input)
              ) +
              (state.progress === undefined
                ? ''
                : this.section(id, 'Saved loop state', this.json(state.progress))) +
              this.section(
                id,
                'Final output',
                status === 'succeeded'
                  ? this.json(state.output)
                  : '<p class="graph-empty">No validated result yet.</p>'
              ) +
              this.section(id, 'Full node settings', this.json(node)) +
              this.section(
                id,
                'Tokens and cost',
                metrics.has_usage
                  ? this.json({totals, models: metrics.models})
                  : '<p class="graph-empty">No usage reported. Simulated responses do not consume model tokens.</p>'
              ) +
              (node.kind === 'map' && !state.map_node_id
                ? '<p class="graph-empty">' +
                  (state.items
                    ? 'Empty collection: no item agents to run.'
                    : 'Item cards appear when the collection is resolved.') +
                  '</p>'
                : this.section(
                    id,
                    node.kind === 'llm'
                      ? 'Structured LLM response'
                      : 'Agent turns and tool calls',
                    this.trace(id, state.attempts)
                  )) +
              '</div>';
          }
          return (
            `<article class="graph-node ${expanded ? 'expanded' : ''}" data-node-id="${escapeText(id)}" data-node-status="${escapeText(status)}">` +
            `<button class="graph-node-toggle" data-expand-node="${escapeText(id)}" aria-expanded="${expanded}"><span class="graph-node-name">${escapeText(id)}</span><span class="graph-expand">${expanded ? '−' : '+'}</span>` +
            `<span class="graph-node-status"><i></i>${escapeText(labels[status] || status)}<span>${state.map_node_id ? 'map item' : escapeText(node.kind)}${state.items ? ' · ' + state.items.filter(item => item.status === 'succeeded').length + '/' + state.items.length + ' complete' : ''}${state.round ? ' · round ' + state.round : ''}${state.attempt ? ' · attempt ' + state.attempt : ''}</span></span>` +
            (state.item_value === undefined
              ? ''
              : '<span class="graph-item-input">' +
                escapeText(
                  state.item_value?.hypothesis?.statement ||
                    state.item_value?.statement ||
                    (typeof state.item_value === 'string'
                      ? state.item_value
                      : JSON.stringify(state.item_value))
                ) +
                '</span>') +
            `<span class="graph-instructions">${escapeText(node.instructions)}</span>` +
            `<span class="graph-node-usage"><span>${tokens} tokens</span><span>${cost}</span></span></button>${body}</article>`
          );
        })
        .join('');
      const viewport = this.element.querySelector('.graph-viewport');
      const scroll = [viewport?.scrollLeft || 0, viewport?.scrollTop || 0];
      this.element.innerHTML = `<div class="graph-viewport"><div class="graph-stage"><div class="graph-canvas"><svg class="graph-edges" aria-hidden="true"><defs><marker id="graph-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6" fill="none" stroke="context-stroke"/></marker></defs><g></g></svg>${cards}</div></div></div><div class="graph-controls" role="group" aria-label="Graph zoom"><span>${saved ? 'Run graph' : 'Draft graph'}</span><button data-graph-zoom=".8" aria-label="Zoom out">−</button><button data-graph-zoom="fit" aria-label="Fit graph">Fit</button><button data-graph-zoom="1.25" aria-label="Zoom in">+</button></div>`;
      this.layout();
      this.element.querySelector('.graph-viewport').scrollTo(...scroll);
    } catch (error) {
      this.element.innerHTML =
        '<div class="graph-placeholder">' + escapeText(error.message) + '</div>';
    }
  }

  layout() {
    const canvas = this.element.querySelector('.graph-canvas');
    if (!canvas || !this.element.clientWidth) {
      return;
    }
    const cards = new Map(
      Array.from(canvas.querySelectorAll('[data-node-id]'), card => [
        card.dataset.nodeId,
        card,
      ])
    );
    const cardWidth = 310,
      gap = 52,
      margin = 28,
      rowGap = 76;
    let y = 24;
    const positions = Object.create(null),
      rowBottoms = [];
    for (const [rank, level] of this.levels.entries()) {
      const row = level
        .map((id, index) => {
          const parents = this.dependenciesMap[id] || [];
          const preferred = parents.length
            ? parents.reduce((sum, parent) => sum + positions[parent].x, 0) /
              parents.length
            : index * (cardWidth + gap);
          return {id, preferred};
        })
        .sort((a, b) => a.preferred - b.preferred || a.id.localeCompare(b.id));
      // Keep chains in their parent's lane; spread forks without overlapping cards.
      let previous = -Infinity;
      const centers = row.map(
        node => (previous = Math.max(node.preferred, previous + cardWidth + gap))
      );
      const shift =
        centers.reduce((sum, x, index) => sum + x - row[index].preferred, 0) / row.length;
      const height = Math.max(...row.map(node => cards.get(node.id).offsetHeight));
      row.forEach(({id}, index) => {
        positions[id] = {
          x: centers[index] - shift,
          y,
          height: cards.get(id).offsetHeight,
          rank,
        };
      });
      rowBottoms.push(y + height);
      y += height + rowGap;
    }
    const bounds = Object.values(positions);
    const left = Math.min(...bounds.map(node => node.x - cardWidth / 2));
    const right = Math.max(...bounds.map(node => node.x + cardWidth / 2));
    let sideRoutes = 0;
    const edges = Object.entries(this.dependenciesMap).flatMap(([id, parents]) =>
      parents
        .toSorted((a, b) => positions[a].x - positions[b].x)
        .map((parent, index) => {
          const from = positions[parent],
            to = positions[id];
          const x =
            to.x +
            (index - (parents.length - 1) / 2) *
              Math.min(18, cardWidth / (parents.length + 1));
          const bottom = from.y + from.height,
            top = to.y - 5;
          let points;
          if (to.rank === from.rank + 1) {
            const middle = (rowBottoms[from.rank] + to.y) / 2;
            points = [
              [from.x, bottom],
              [from.x, middle],
              [x, middle],
              [x, top],
            ];
          } else {
            const blocked = bounds.some(
              node =>
                node.rank > from.rank &&
                node.rank < to.rank &&
                Math.abs(node.x - from.x) < cardWidth / 2 + 12
            );
            const entry = to.y - rowGap / 3;
            if (blocked) {
              // Long edges use an outer lane when a card occupies the direct route.
              const lane = right + 24 + sideRoutes++ * 16,
                exit = rowBottoms[from.rank] + rowGap / 3;
              points = [
                [from.x, bottom],
                [from.x, exit],
                [lane, exit],
                [lane, entry],
                [x, entry],
                [x, top],
              ];
            } else {
              points = [
                [from.x, bottom],
                [from.x, entry],
                [x, entry],
                [x, top],
              ];
            }
          }
          return {id, parent, points};
        })
    );
    for (const loop of this.loops || []) {
      const from = positions[loop.from],
        to = positions[loop.to];
      const lane = Math.max(from.x, to.x) + cardWidth / 2 + 22;
      edges.push({
        id: loop.to,
        parent: loop.from,
        feedback: true,
        points: [
          [from.x + cardWidth / 2, from.y + 30],
          [lane, from.y + 30],
          [lane, to.y + 30],
          [to.x + cardWidth / 2 + 5, to.y + 30],
        ],
      });
    }
    const contentWidth =
      right -
      left +
      Math.max(this.loops?.length ? 22 : 0, sideRoutes ? 24 + (sideRoutes - 1) * 16 : 0);
    const width = Math.max(this.element.clientWidth - 2, contentWidth + margin * 2);
    const offset = (width - contentWidth) / 2 - left;
    for (const [id, position] of Object.entries(positions)) {
      const card = cards.get(id);
      card.style.left = position.x + offset - cardWidth / 2 + 'px';
      card.style.top = position.y + 'px';
    }
    const height = y - rowGap + margin;
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    const availableHeight = Math.max(80, this.element.clientHeight - 52);
    this.scale =
      this.zoom ??
      Math.min(1, (this.element.clientWidth - 2) / width, availableHeight / height);
    canvas.style.transform = `scale(${this.scale})`;
    canvas.parentElement.style.width = Math.ceil(width * this.scale) + 'px';
    canvas.parentElement.style.height = Math.ceil(height * this.scale) + 'px';
    const svg = canvas.querySelector('svg');
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.querySelector('g').innerHTML = edges
      .map(({id, parent, points, feedback}) => {
        const active =
          this.states[id]?.status === 'running' &&
          (this.states[parent]?.status === 'succeeded' ||
            (feedback && this.states[parent]?.status === 'failed'));
        const path = points
          .map(([x, y], index) => `${index ? 'L' : 'M'}${x + offset},${y}`)
          .join(' ');
        return `<path class="${active ? 'active' : ''}" d="${path}" marker-end="url(#graph-arrow)"/>`;
      })
      .join('');
  }
}
