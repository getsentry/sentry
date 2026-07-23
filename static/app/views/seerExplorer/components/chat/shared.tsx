import {MessageRow, Spinner, type ToolCallStatus} from '@sentry/scraps/chat';
import {Flex} from '@sentry/scraps/layout';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {t} from 'sentry/locale';
import type {Block, SeerExplorerRunId} from 'sentry/views/seerExplorer/types';

interface BlockVariantProps {
  block: Block;
}

export interface UserBlockProps extends BlockVariantProps {}

export interface AssistantBlockProps extends BlockVariantProps {
  blockIndex: number;
  interactionPending?: boolean;
  readOnly?: boolean;
  runId?: SeerExplorerRunId;
}

export interface ToolUseBlockProps extends BlockVariantProps {
  blocks?: Block[];
  getPageReferrer?: () => string;
  showThinking?: boolean;
}

export function getBlockStatus(block: Block): ToolCallStatus {
  if (block.loading) {
    return 'loading';
  }

  if (!block.message.tool_calls?.length) {
    return 'content';
  }

  const toolLinks = (block.tool_links ?? []).filter(
    (l): l is NonNullable<typeof l> => l !== null
  );

  if (toolLinks.some(l => l.params?.pending_approval || l.params?.pending_question)) {
    return 'pending';
  }

  if (!toolLinks.length) {
    return 'success';
  }

  const failures = toolLinks.filter(l => l.params?.is_error === true).length;

  if (failures === 0) {
    return 'success';
  }
  if (failures === toolLinks.length) {
    return 'failure';
  }
  return 'mixed';
}

export function hasValidContent(content: string | null | undefined): content is string {
  if (!content) {
    return false;
  }
  const trimmed = content.trim();
  return trimmed.length > 0 && trimmed !== '.';
}

export function MessagePlaceholder({content}: {content?: string}) {
  return (
    <MessageRow from="assistant">
      <Flex align="center" gap="md">
        <Flex
          display="inline-flex"
          align="center"
          justify="center"
          width="12px"
          height="12px"
          flexShrink={0}
        >
          <Spinner role="status" aria-label={t('Loading')} />
        </Flex>
        {hasValidContent(content) && <SeerMarkdown raw={content} />}
      </Flex>
    </MessageRow>
  );
}

export const BLOCK_WRAPPER_SELECTOR = '[data-block-wrapper]';
