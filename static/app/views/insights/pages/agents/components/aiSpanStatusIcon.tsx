import {useTheme} from '@emotion/react';
import {IconBookmark} from '@sentry/icons/bookmark';
import {IconBot} from '@sentry/icons/bot';
import {IconChat} from '@sentry/icons/chat';
import {IconChevron} from '@sentry/icons/chevron';
import {IconCode} from '@sentry/icons/code';
import {IconFire} from '@sentry/icons/fire';
import {IconFix} from '@sentry/icons/fix';
import {IconSearch} from '@sentry/icons/search';
import {IconTag} from '@sentry/icons/tag';

import {Container, Flex} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {
  getGenAiOpType,
  getSpanColor,
  getTimelineColorByOpType,
  getTraceNodeAttribute,
  hasError,
} from 'sentry/views/insights/pages/agents/utils/aiTraceNodes';
import {isCodeModeNode} from 'sentry/views/insights/pages/agents/utils/codeMode';
import {isEvaluationNode} from 'sentry/views/insights/pages/agents/utils/evaluation';
import {
  isMemoryNode,
  MemoryOperation,
} from 'sentry/views/insights/pages/agents/utils/memory';
import {GenAiOperationType} from 'sentry/views/insights/pages/agents/utils/query';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';
import {SpanFields} from 'sentry/views/insights/types';

function operationTypeIcon(node: AITraceSpanNode) {
  // Decision spans report the ai_client operation type like LLM calls, but
  // answer yes/no, score, or categorize questions about an input rather than
  // produce a response.
  if (isEvaluationNode(node)) {
    return <IconTag size="md" />;
  }
  // Searches read memory; every other memory operation changes what's saved.
  if (isMemoryNode(node)) {
    const operationName = getTraceNodeAttribute(SpanFields.GEN_AI_OPERATION_NAME, node);
    return operationName === MemoryOperation.SEARCH ? (
      <IconSearch size="md" />
    ) : (
      <IconBookmark size="md" />
    );
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
  const isCodeMode = isCodeModeNode(node);
  const hasErrors = hasError(node);
  const iconColor = getSpanColor(node, getTimelineColorByOpType(theme));

  return (
    <Flex align="center" position="relative" style={{color: iconColor}} flexShrink={0}>
      {isCodeMode ? <IconCode size="md" /> : operationTypeIcon(node)}
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
