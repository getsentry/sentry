import {IconDownload} from '@sentry/icons/download';

import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import type {UseConversationsOptions} from 'sentry/views/explore/conversations/hooks/useConversation';
import {useExportConversation} from 'sentry/views/explore/conversations/hooks/useExportConversation';

interface ExportTranscriptButtonProps {
  conversation: UseConversationsOptions;
}

export function ExportTranscriptButton({conversation}: ExportTranscriptButtonProps) {
  const {copyConversation, downloadConversation, isExporting} =
    useExportConversation(conversation);

  return (
    <DropdownMenu
      size="xs"
      trigger={triggerProps => (
        <OverlayTrigger.Button
          showChevron={false}
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
        </OverlayTrigger.Button>
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
