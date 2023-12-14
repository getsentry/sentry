import styled from '@emotion/styled';

import {getIgnoreActions} from 'sentry/components/actions/ignore';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {GroupStatus, GroupStatusResolution, GroupSubstatus} from 'sentry/types';

interface ArchiveActionProps {
  onUpdate: (params: GroupStatusResolution) => void;
  className?: string;
  confirmLabel?: string;
  confirmMessage?: () => React.ReactNode;
  disableArchiveUntilOccurrence?: boolean;
  disabled?: boolean;
  isArchived?: boolean;
  shouldConfirm?: boolean;
  size?: 'xs' | 'sm';
}

const ARCHIVE_UNTIL_ESCALATING: GroupStatusResolution = {
  status: GroupStatus.IGNORED,
  statusDetails: {},
  substatus: GroupSubstatus.ARCHIVED_UNTIL_ESCALATING,
};
const ARCHIVE_FOREVER: GroupStatusResolution = {
  status: GroupStatus.IGNORED,
  statusDetails: {},
  substatus: GroupSubstatus.ARCHIVED_FOREVER,
};

type GetArchiveActionsProps = Pick<
  ArchiveActionProps,
  'shouldConfirm' | 'confirmMessage' | 'onUpdate' | 'confirmLabel'
> & {
  disableArchiveUntilOccurrence?: boolean;
};

export function getArchiveActions({
  shouldConfirm,
  confirmLabel,
  confirmMessage,
  onUpdate,
  disableArchiveUntilOccurrence,
}: GetArchiveActionsProps): {
  dropdownItems: MenuItemProps[];
  onArchive: (resolution: GroupStatusResolution) => void;
} {
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
        label: t('Until escalating'),
        details: t('When events exceed their weekly forecast'),
        onAction: () => onArchive(ARCHIVE_UNTIL_ESCALATING),
      },
      {
        key: 'forever',
        label: t('Forever'),
        onAction: () => onArchive(ARCHIVE_FOREVER),
      },
      ...dropdownItems.filter(item => {
        if (disableArchiveUntilOccurrence) {
          return item.key !== 'until-reoccur' && item.key !== 'until-affect';
        }
        return true;
      }),
    ],
  };
}

function ArchiveActions({
  size = 'xs',
  disabled,
  disableArchiveUntilOccurrence,
  className,
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
        onClick={() =>
          onUpdate({
            status: GroupStatus.UNRESOLVED,
            statusDetails: {},
            substatus: GroupSubstatus.ONGOING,
          })
        }
        aria-label={t('Unarchive')}
      />
    );
  }

  const {dropdownItems, onArchive} = getArchiveActions({
    confirmLabel,
    onUpdate,
    shouldConfirm,
    confirmMessage,
    disableArchiveUntilOccurrence,
  });

  return (
    <ButtonBar className={className} merged>
      <ArchiveButton
        size={size}
        tooltipProps={{delay: 1000, disabled, isHoverable: true}}
        title={tct(
          'We’ll nag you with a notification if the issue gets worse. All archived issues can be found in the Archived tab. [docs:Read the docs]',
          {
            docs: (
              <ExternalLink href="https://docs.sentry.io/product/issues/states-triage/#archive" />
            ),
          }
        )}
        onClick={() => onArchive(ARCHIVE_UNTIL_ESCALATING)}
        disabled={disabled}
      >
        {t('Archive')}
      </ArchiveButton>
      <DropdownMenu
        minMenuWidth={270}
        size="sm"
        trigger={triggerProps => (
          <DropdownTrigger
            {...triggerProps}
            aria-label={t('Archive options')}
            size={size}
            icon={<IconChevron direction="down" />}
            disabled={disabled}
          />
        )}
        menuTitle={
          <MenuWrapper>
            {t('Archive')}
            <StyledExternalLink href="https://docs.sentry.io/product/issues/states-triage/#archive">
              {t('Read the docs')}
            </StyledExternalLink>
          </MenuWrapper>
        }
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

const MenuWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const StyledExternalLink = styled(ExternalLink)`
  font-weight: normal;
`;
