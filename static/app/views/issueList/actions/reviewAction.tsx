import type {TooltipProps} from '@sentry/scraps/tooltip';

import {ActionLink} from 'sentry/components/actions/actionLink';
import {openConfirmModal} from 'sentry/components/confirm';
import {IconIssues} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {IssueUpdateData} from 'sentry/views/issueList/types';

type Props = {
  onUpdate: (data: IssueUpdateData) => void;
  confirmLabel?: string;
  confirmMessage?: React.ReactNode;
  disabled?: boolean;
  onShouldConfirm?: () => boolean;
  tooltip?: string;
  tooltipProps?: Omit<TooltipProps, 'children' | 'title' | 'skipWrapper'>;
};

export function ReviewAction({
  disabled,
  onUpdate,
  tooltipProps,
  tooltip,
  onShouldConfirm,
  confirmMessage,
  confirmLabel,
}: Props) {
  return (
    <ActionLink
      type="button"
      disabled={disabled}
      onAction={() => {
        openConfirmModal({
          bypass: !onShouldConfirm?.(),
          onConfirm: () => onUpdate({inbox: false}),
          message: confirmMessage,
          confirmText: confirmLabel ?? t('Confirm'),
        });
      }}
      icon={<IconIssues size="xs" />}
      title={tooltip}
      tooltipProps={tooltipProps}
    >
      {t('Mark Reviewed')}
    </ActionLink>
  );
}
