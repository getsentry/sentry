import type {TagVariant} from '@sentry/scraps/theme';

import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';

/**
 * Feedback submitted by an agent through an MCP server's feedback tool, rather
 * than by a person through the feedback widget.
 */
const AGENT_FEEDBACK_SOURCE = 'mcp_agent';

export const AGENT_TAG = {
  tool: 'feedback.tool',
  impact: 'feedback.impact',
  kind: 'feedback.kind',
  clientFamily: 'app.client.family',
  serverVersion: 'app.server.version',
  transport: 'app.transport',
} as const;

/**
 * The event says where the feedback came from. The issue does not: its
 * `metadata.source` is how the feedback was ingested, so in the list, where
 * there is no event, the reporter name is the only thing to go on.
 */
export function isAgentFeedback(
  metadata: {name?: string | null} | undefined,
  event?: Event
) {
  return (
    event?.contexts?.feedback?.source === AGENT_FEEDBACK_SOURCE ||
    getAgentClient(metadata?.name) !== null
  );
}

interface AgentMessage {
  body: string;
  task: string | null;
  tool: string | null;
}

/**
 * Agents write their report as `Task: …`, an optional `Tool: …`, then prose.
 */
export function parseAgentMessage(message: string): AgentMessage {
  const lines = message.split('\n');
  let index = 0;
  let task: string | null = null;
  let tool: string | null = null;

  if (lines[index]?.startsWith('Task:')) {
    task = lines[index]!.slice('Task:'.length).trim();
    index++;
  }
  if (lines[index]?.startsWith('Tool:')) {
    tool = lines[index]!.slice('Tool:'.length).trim();
    index++;
  }

  return {task, tool, body: lines.slice(index).join('\n').trim()};
}

/**
 * The reporter name looks like `MCP agent (claude) for user 123`.
 */
export function getAgentClient(name: string | null | undefined) {
  return name?.match(/^MCP agent \((.+?)\)/)?.[1] ?? null;
}

export function getEventTag(event: Event | undefined, key: string) {
  return event?.tags.find(tag => tag.key === key)?.value;
}

export function getImpactDisplay(impact: string): {label: string; variant: TagVariant} {
  switch (impact) {
    case 'blocked':
      return {label: t('Blocked'), variant: 'danger'};
    case 'worked_around':
      return {label: t('Worked around'), variant: 'warning'};
    case 'friction':
      return {label: t('Friction'), variant: 'muted'};
    default:
      return {label: impact, variant: 'muted'};
  }
}

export function getKindLabel(kind: string) {
  switch (kind) {
    case 'broken':
      return t('Broken');
    case 'missing':
      return t('Missing');
    case 'confusing':
      return t('Confusing');
    case 'idea':
      return t('Idea');
    default:
      return kind;
  }
}
