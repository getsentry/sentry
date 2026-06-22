import {Button, type ButtonProps} from '@sentry/scraps/button';
import {useModal} from '@sentry/scraps/modal';

import {IconDownload} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getExportDisabledTooltip} from 'sentry/views/explore/components/getExportDisabledTooltip';
import {ExploreExportModal} from 'sentry/views/explore/components/exports/exploreExportModal';
import type {
  ExploreExportConfig,
  ExploreExportModalCloseReason,
} from 'sentry/views/explore/components/exports/types';

const GLOBAL_MODAL_DISMISS_TO_CLOSE_REASON = {
  'backdrop-click': 'backdrop_click',
  'close-button': 'close_button',
  'escape-key': 'escape_key',
} as const;

type ExploreExportModalButtonProps = {
  config: ExploreExportConfig;
  isDataEmpty: boolean;
  isDataError: boolean;
  isDataLoading: boolean;
  onClose?: (reason: ExploreExportModalCloseReason) => void;
  onOpen?: () => void;
  size?: ButtonProps['size'];
};

export function ExploreExportModalButton({
  config,
  isDataEmpty,
  isDataError,
  isDataLoading,
  onClose,
  onOpen,
  size = 'xs',
}: ExploreExportModalButtonProps) {
  const {openModal} = useModal();

  const disabledTooltip = getExportDisabledTooltip({
    isDataEmpty,
    isDataError,
    isDataLoading,
  });

  return (
    <Button
      disabled={!!disabledTooltip}
      size={size}
      variant="secondary"
      icon={<IconDownload />}
      onClick={() => {
        onOpen?.();
        openModal(
          deps => (
            <ExploreExportModal
              {...deps}
              config={config}
              onCancel={() => onClose?.('cancel_button')}
            />
          ),
          {
            onClose: reason => {
              if (reason) {
                onClose?.(GLOBAL_MODAL_DISMISS_TO_CLOSE_REASON[reason]);
              }
            },
          }
        );
      }}
      tooltipProps={{
        title:
          disabledTooltip ?? t('Configure export options before starting your export.'),
      }}
    >
      {t('Export Data')}
    </Button>
  );
}
