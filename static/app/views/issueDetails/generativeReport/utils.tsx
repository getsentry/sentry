import type {Theme} from '@emotion/react';

import {type GroupActivity, GroupActivityType} from 'sentry/types/group';

/**
 * Machine marker that a scheduled agent prepends (as the first line) to a
 * comment whose body is a self-contained HTML report. The issue detail view
 * detects this marker and renders the comment as a sandboxed report instead of
 * a normal markdown note.
 */
export const GENERATIVE_REPORT_MARKER = '<!--SENTRY_GENERATIVE_REPORT';

type GroupActivityNote = Extract<GroupActivity, {type: GroupActivityType.NOTE}>;

export function isGenerativeReportNote(
  activity: GroupActivity
): activity is GroupActivityNote {
  return (
    activity.type === GroupActivityType.NOTE &&
    activity.data.text.trimStart().startsWith(GENERATIVE_REPORT_MARKER)
  );
}

/**
 * Strips the leading marker line, returning the raw HTML body of the report.
 */
export function getReportHtml(text: string): string {
  const trimmed = text.trimStart();
  const newlineIndex = trimmed.indexOf('\n');
  return newlineIndex === -1 ? '' : trimmed.slice(newlineIndex + 1).trim();
}

/**
 * Returns the most recently created report note, if any.
 */
export function findLatestReportNote(
  activities: GroupActivity[]
): GroupActivityNote | undefined {
  return activities
    .filter(isGenerativeReportNote)
    .sort(
      (a, b) => new Date(b.dateCreated).getTime() - new Date(a.dateCreated).getTime()
    )[0];
}

const SYSTEM_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const MONO_FONT_STACK =
  'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

/**
 * The class vocabulary agents are told to emit (see the agent prompt). The shell
 * below owns all styling so the report matches Sentry's theme (light/dark) rather
 * than shipping its own hardcoded palette. Kept in sync with the prompt contract.
 */
function reportStylesheet(theme: Theme): string {
  const t = theme.tokens;
  return `
    :root {
      --gr-bg: ${t.background.primary};
      --gr-panel: ${t.background.secondary};
      --gr-panel-2: ${t.background.tertiary};
      --gr-text: ${t.content.primary};
      --gr-muted: ${t.content.secondary};
      --gr-accent: ${t.content.accent};
      --gr-border: ${t.border.primary};
      --gr-danger: ${t.content.danger};
      --gr-warn: ${t.content.warning};
      --gr-ok: ${t.content.success};
      --gr-chart: ${t.graphics.accent.vibrant};
      --gr-chart-2: ${t.graphics.promotion.vibrant};
      --gr-radius: ${theme.radius.md};
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    .gr-root {
      font-family: ${SYSTEM_FONT_STACK};
      background: var(--gr-bg);
      color: var(--gr-text);
      line-height: 1.5;
      font-size: 13px;
      padding: 4px 2px 16px;
    }
    .gr-root h1 { font-size: 20px; margin: 0 0 4px; }
    .gr-h2 { font-size: 15px; margin: 24px 0 10px; color: var(--gr-accent);
      border-bottom: 1px solid var(--gr-border); padding-bottom: 6px; font-weight: 600; }
    .gr-h3 { font-size: 11px; margin: 14px 0 8px; color: var(--gr-muted);
      text-transform: uppercase; letter-spacing: .04em; font-weight: 600; }
    .gr-card { background: var(--gr-panel); border: 1px solid var(--gr-border);
      border-radius: var(--gr-radius); padding: 14px 16px; margin-bottom: 14px; }
    .gr-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; }
    .gr-stat { background: var(--gr-panel-2); border: 1px solid var(--gr-border);
      border-radius: var(--gr-radius); padding: 10px 12px; }
    .gr-stat .label { color: var(--gr-muted); font-size: 10px; text-transform: uppercase; letter-spacing: .05em; }
    .gr-stat .value { font-size: 18px; font-weight: 600; margin-top: 4px; }
    .gr-badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 600;
      background: color-mix(in srgb, var(--gr-muted) 15%, transparent); color: var(--gr-muted); }
    .gr-badge.danger { background: color-mix(in srgb, var(--gr-danger) 15%, transparent); color: var(--gr-danger); }
    .gr-badge.warn { background: color-mix(in srgb, var(--gr-warn) 18%, transparent); color: var(--gr-warn); }
    .gr-badge.ok { background: color-mix(in srgb, var(--gr-ok) 15%, transparent); color: var(--gr-ok); }
    .gr-badge.muted { background: color-mix(in srgb, var(--gr-muted) 15%, transparent); color: var(--gr-muted); }
    .gr-table { width: 100%; border-collapse: collapse; font-size: 12px; }
    .gr-table th, .gr-table td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--gr-border);
      vertical-align: top; }
    .gr-table th { color: var(--gr-muted); font-weight: 600; font-size: 10px; text-transform: uppercase; }
    .gr-bar { display: flex; align-items: center; gap: 8px; margin: 4px 0; font-size: 11px; color: var(--gr-muted); }
    .gr-bar > .track { flex: 1; height: 10px; background: var(--gr-panel-2); border-radius: 999px; overflow: hidden; }
    .gr-bar > .track > span { display: block; height: 100%; background: var(--gr-chart); border-radius: 999px; }
    a { color: var(--gr-accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
    ol, ul { padding-left: 20px; margin: 8px 0; }
    li { margin-bottom: 6px; }
    code { font-family: ${MONO_FONT_STACK}; font-size: 12px;
      background: color-mix(in srgb, var(--gr-muted) 12%, transparent); padding: 1px 5px; border-radius: 4px; }
    pre { font-family: ${MONO_FONT_STACK}; background: var(--gr-panel-2); border: 1px solid var(--gr-border);
      border-radius: var(--gr-radius); padding: 12px; overflow-x: auto; font-size: 12px; }
    pre code { background: none; padding: 0; }
    svg { max-width: 100%; height: auto; }
  `;
}

/**
 * Reports its own height to the parent so the iframe can auto-size instead of a
 * fixed viewport height. The parent matches on the message type.
 */
const RESIZE_SCRIPT = `
  (function () {
    function post() {
      var h = document.documentElement.scrollHeight;
      parent.postMessage({type: 'gr-height', height: h}, '*');
    }
    window.addEventListener('load', post);
    if (window.ResizeObserver) {
      new ResizeObserver(post).observe(document.documentElement);
    }
    post();
  })();
`;

/**
 * Wraps an agent-emitted HTML body fragment in a themed document for the iframe
 * `srcDoc`. The app owns all chrome (theme, fonts, layout classes) so the report
 * looks native regardless of the model's output.
 *
 * Backward-compat: older reports were full self-contained documents. If the
 * content already looks like a full document, render it unchanged.
 */
export function buildReportSrcDoc(fragment: string, theme: Theme): string {
  const lead = fragment.trimStart().slice(0, 20).toLowerCase();
  if (lead.startsWith('<!doctype') || lead.startsWith('<html')) {
    return fragment;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>${reportStylesheet(theme)}</style>
</head>
<body>
<div class="gr-root">${fragment}</div>
<script>${RESIZE_SCRIPT}</script>
</body>
</html>`;
}
