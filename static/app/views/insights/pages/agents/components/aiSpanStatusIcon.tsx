import {useTheme} from '@emotion/react';
import {IconBot} from '@sentry/icons/iconBot';
import {IconChat} from '@sentry/icons/iconChat';
import {IconChevron} from '@sentry/icons/iconChevron';
import {IconCode} from '@sentry/icons/iconCode';
import {IconFire} from '@sentry/icons/iconFire';
import {IconFix} from '@sentry/icons/iconFix';
import {IconList} from '@sentry/icons/iconList';
import {IconStack} from '@sentry/icons/iconStack';

import {Container, Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {
  getGenAiOpType,
  getSpanColor,
  getTimelineColorByOpType,
  hasError,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {isEvaluationNode} from 'sentry/views/insights/pages/agents/utils/evaluation';
import {isMemoryNode} from 'sentry/views/insights/pages/agents/utils/memory';
import {GenAiOperationType} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

function operationTypeIcon(node: AITraceSpanNode) {
  // Evaluations report the ai_client operation type like LLM calls, but
  // answer a list of questions about a response rather than produce one.
  // TODO: Replace with a dedicated evaluation icon once design provides one.
  if (isEvaluationNode(node)) {
    return <IconList size="md" />;
  }
  // TODO: Replace IconStack with a dedicated memory icon once design provides one.
  if (isMemoryNode(node)) {
    return <IconStack size="md" />;
  }
  switch (getGenAiOpType(node)) {
    case GenAiOperationType.AGENT:
      return <IconBot size="md" />;
    case GenAiOperationType.AI_CLIENT:
      return <IconChat size="md" />;
    case GenAiOperationType.TOOL:
      return <IconFix size="md" />;
    case GenAiOperationType.HANDOFF:
      return <IconChevron size="md" isDouble direction="right" />;
    default:
      return <IconCode size="md" />;
  }
}

interface AiSpanStatusIconProps {
  node: AITraceSpanNode;
}

/**
 * Operation-type icon for an AI span with a shared errored treatment: a small
 * `IconFire` badge overlapping the bottom-right corner when the span errored.
 * Used across the timeline, transcript, and span detail so the errored icon
 * looks the same everywhere.
 */
export function AiSpanStatusIcon({node}: AiSpanStatusIconProps) {
  const theme = useTheme();
  const hasErrors = hasError(node);
  const iconColor = getSpanColor(node, getTimelineColorByOpType(theme));

  return (
    <Flex align="center" position="relative" style={{color: iconColor}} flexShrink={0}>
      {operationTypeIcon(node)}
      {hasErrors && (
        <Tooltip title={t('This span encountered an error')} skipWrapper>
          <Container
            position="absolute"
            radius="full"
            style={{
              // Nudges the badge diagonally so the fire sits just outside the
              // bottom-right corner of the 16x16 icon.
              bottom: -6,
              right: -6,
              padding: 1,
              background: theme.tokens.background.primary,
            }}
          >
            <IconFire display="block" size="xs" variant="danger" />
          </Container>
        </Tooltip>
      )}
    </Flex>
  );
}
