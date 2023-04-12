import styled from '@emotion/styled';

import {getIgnoreActions} from 'sentry/components/actions/ignore';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconArchive, IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {GroupStatusResolution, ResolutionStatus} from 'sentry/types';

interface ArchiveActionProps {
  onUpdate: (params: GroupStatusResolution) => void;
  className?: string;
  confirmLabel?: string;
  confirmMessage?: () => React.ReactNode;
  disableTooltip?: boolean;
  disabled?: boolean;
  hideIcon?: boolean;
  isArchived?: boolean;
  shouldConfirm?: boolean;
  size?: 'xs' | 'sm';
}

const ARCHIVE_UNTIL_ESCALATING: GroupStatusResolution = {
  status: ResolutionStatus.IGNORED,
  statusDetails: {},
  substatus: 'until_escalating',
};
const ARCHIVE_FOREVER: GroupStatusResolution = {
  status: ResolutionStatus.IGNORED,
  statusDetails: {},
};

export function getArchiveActions({
  shouldConfirm,
  confirmLabel,
  confirmMessage,
  onUpdate,
}: Pick<
  ArchiveActionProps,
  'shouldConfirm' | 'confirmMessage' | 'onUpdate' | 'confirmLabel'
>) {
  // TODO(workflow): Replace ignore actions with more archive actions
  const {dropdownItems} = getIgnoreActions({
    confirmLabel,
    onUpdate,
    shouldConfirm,
    confirmMessage,
  });

  const onArchive = (resolution: GroupStatusResolution) => {
    if (shouldConfirm && confirmMessage) {
      openConfirmModal({
        onConfirm: () => onUpdate(resolution),
        message: confirmMessage(),
        confirmText: confirmLabel,
      });
    } else {
      onUpdate(resolution);
    }
  };

  return {
    onArchive,
    dropdownItems: [
      {
        key: 'untilEscalating',
        label: t('Until it escalates'),
        onAction: () => onArchive(ARCHIVE_UNTIL_ESCALATING),
      },
      {
        key: 'forever',
        label: t('Forever'),
        onAction: () => onArchive(ARCHIVE_FOREVER),
      },
      ...dropdownItems,
    ],
  };
}

function ArchiveActions({
  size = 'xs',
  disabled,
  disableTooltip,
  className,
  hideIcon,
  shouldConfirm,
  confirmLabel,
  isArchived,
  confirmMessage,
  onUpdate,
}: ArchiveActionProps) {
  if (isArchived) {
    return (
      <Button
        priority="primary"
        size="xs"
        title={t('Change status to unresolved')}
        onClick={() => onUpdate({status: ResolutionStatus.UNRESOLVED, statusDetails: {}})}
        aria-label={t('Unarchive')}
        icon={<IconArchive size="xs" />}
      />
    );
  }

  const {dropdownItems, onArchive} = getArchiveActions({
    confirmLabel,
    onUpdate,
    shouldConfirm,
    confirmMessage,
  });

  return (
    <ButtonBar className={className} merged>
      <ArchiveButton
        size={size}
        tooltipProps={{delay: 300, disabled: disabled || disableTooltip}}
        title={t(
          'Silences alerts for this issue and removes it from the issue stream by default.'
        )}
        icon={hideIcon ? null : <IconArchive size={size} />}
        onClick={() => onArchive(ARCHIVE_UNTIL_ESCALATING)}
        disabled={disabled}
      >
        {t('Archive')}
      </ArchiveButton>
      <DropdownMenu
        size="sm"
        trigger={triggerProps => (
          <DropdownTrigger
            {...triggerProps}
            aria-label={t('Archive options')}
            size={size}
            icon={<IconChevron direction="down" size="xs" />}
            disabled={disabled}
          />
        )}
        menuTitle={t('Archive')}
        items={dropdownItems}
        isDisabled={disabled}
      />
    </ButtonBar>
  );
}

export default ArchiveActions;

const ArchiveButton = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusLeft};
`;

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusRight};
  border-left: none;
`;
