import {IconDownload} from '@sentry/icons/download';

import {Button} from '@sentry/scraps/button';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';

import {t} from 'sentry/locale';
import type {UseConversationsOptions} from 'sentry/views/explore/conversations/hooks/useConversation';
import {useExportConversation} from 'sentry/views/explore/conversations/hooks/useExportConversation';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

interface ExportTranscriptButtonProps {
  conversation: UseConversationsOptions;
  /** Whether `nodes` already holds the whole conversation (see useConversation). */
  isFullyLoaded: boolean;
  /** Nodes already loaded by the display query, reused when complete. */
  nodes: AITraceSpanNode[];
  title: string | null;
}

/**
 * Dropdown that copies or downloads the conversation transcript as Markdown.
 * Reuses the already-loaded nodes when the conversation is fully loaded, and
 * otherwise fetches every page on demand (see useExportConversation).
 */
export function ExportTranscriptButton({
  conversation,
  nodes,
  title,
  isFullyLoaded,
}: ExportTranscriptButtonProps) {
  const {copyConversation, downloadConversation, isExporting} = useExportConversation({
    conversation,
    loadedNodes: nodes,
    title,
    isFullyLoaded,
  });

  return (
    <DropdownMenu
      size="xs"
      trigger={triggerProps => (
        <Button
          {...triggerProps}
          size="xs"
          icon={<IconDownload />}
          busy={isExporting}
          disabled={isExporting}
          tooltipProps={
            isExporting
              ? {title: t('Loading the full conversation. This can take a while.')}
              : undefined
          }
        >
          {t('Export transcript')}
        </Button>
      )}
      items={[
        {
          key: 'copy',
          label: t('Copy to clipboard'),
          onAction: copyConversation,
        },
        {
          key: 'download',
          label: t('Download .md'),
          onAction: downloadConversation,
        },
      ]}
    />
  );
}
