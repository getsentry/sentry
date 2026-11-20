import {IconFire} from '@sentry/icons/fire';

import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  ensureAttributeObject,
  getIsExecuteToolNode,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';
import type {BaseNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';

import {SpanErrorCard} from './spanErrorCard';

/**
 * Follows the OTel GenAI conventions: the span status marks the failure,
 * `error.type` classifies it and the status message carries the human-readable
 * message. MCP tool results flagged with `is_error` fail too, with their result
 * content as the message.
 */
function getToolError(node: AITraceSpanNode, attributes: TraceItemResponseAttribute[]) {
  const attributeObject = ensureAttributeObject(node, undefined, attributes) ?? {};
  const getString = (key: string): string | undefined => {
    const value = attributeObject[key];
    return value === undefined || value === '' ? undefined : String(value);
  };

  const isMcpError = getString('mcp.tool.result.is_error') === 'true';
  if (!getString(SpanFields.SPAN_STATUS)?.includes('error') && !isMcpError) {
    return null;
  }

  return {
    type: getString('error.type'),
    message:
      getString(SpanFields.STATUS_MESSAGE) ??
      getString('sentry.status.message') ??
      (isMcpError ? getString('mcp.tool.result.content') : undefined),
  };
}

interface ToolErrorCardProps {
  node: BaseNode;
  attributes?: TraceItemResponseAttribute[];
  className?: string;
}

export function ToolErrorCard({node, attributes, className}: ToolErrorCardProps) {
  const error =
    attributes && getIsExecuteToolNode(node) ? getToolError(node, attributes) : null;
  if (!error) {
    return null;
  }

  return (
    <SpanErrorCard
      className={className}
      icon={<IconFire size="md" variant="danger" />}
      title={<Text bold>{error.type ?? t('Tool Error')}</Text>}
      message={
        error.message ? (
          <Text size="sm" wrap="pre-wrap" wordBreak="break-word">
            {error.message}
          </Text>
        ) : (
          <Text size="sm" variant="muted">
            {t('This tool call failed but has no associated issue.')}
          </Text>
        )
      }
    />
  );
}
