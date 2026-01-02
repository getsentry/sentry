import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {openModal} from 'sentry/actionCreators/modal';
import {openConfirmModal} from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {ExternalLink} from 'sentry/components/core/link';
import CustomIgnoreCountModal from 'sentry/components/customIgnoreCountModal';
import CustomIgnoreDurationModal from 'sentry/components/customIgnoreDurationModal';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {IconChevron} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {GroupStatusResolution, IgnoredStatusDetails} from 'sentry/types/group';
import {GroupStatus, GroupSubstatus} from 'sentry/types/group';
import getDuration from 'sentry/utils/duration/getDuration';

const ONE_HOUR = 60;

/**
 * Ignore durations are in munutes
 */
const IGNORE_DURATIONS = [
  ONE_HOUR / 2,
  ONE_HOUR * 2,
  ONE_HOUR * 6,
  ONE_HOUR * 24,
  ONE_HOUR * 24 * 7,
];

const IGNORE_COUNTS = [1, 10, 100, 1000, 10000, 100000];

const IGNORE_WINDOWS = [
  {value: ONE_HOUR, label: t('per hour')},
  {value: ONE_HOUR * 24, label: t('per day')},
  {value: ONE_HOUR * 24 * 7, label: t('per week')},
] satisfies Array<SelectValue<number>>;

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
  const onIgnore = (
    statusDetails: IgnoredStatusDetails | undefined = {},
    {bypassConfirm} = {bypassConfirm: false}
  ) => {
    openConfirmModal({
      bypass: bypassConfirm || !shouldConfirm,
      onConfirm: () =>
        onUpdate({
          status: GroupStatus.IGNORED,
          statusDetails,
          substatus: GroupSubstatus.ARCHIVED_UNTIL_CONDITION_MET,
        }),
      message: confirmMessage?.() ?? null,
      confirmText: confirmLabel,
    });
  };

  const onCustomIgnore = (statusDetails: IgnoredStatusDetails) => {
    onIgnore(statusDetails, {bypassConfirm: true});
  };

  const openCustomIgnoreDuration = () =>
    openModal(deps => (
      <CustomIgnoreDurationModal
        {...deps}
        onSelected={details => onCustomIgnore(details)}
      />
    ));

  const openCustomIgnoreCount = () =>
    openModal(deps => (
      <CustomIgnoreCountModal
        {...deps}
        onSelected={details => onCustomIgnore(details)}
        label={t('Archive this issue until it occurs again\u2026')}
        countLabel={t('Number of times')}
        countName="ignoreCount"
        windowName="ignoreWindow"
        windowOptions={IGNORE_WINDOWS}
      />
    ));

  const openCustomIgnoreUserCount = () =>
    openModal(deps => (
      <CustomIgnoreCountModal
        {...deps}
        onSelected={details => onCustomIgnore(details)}
        label={t('Archive this issue until it affects an additional\u2026')}
        countLabel={t('Number of users')}
        countName="ignoreUserCount"
        windowName="ignoreUserWindow"
        windowOptions={IGNORE_WINDOWS}
      />
    ));

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

  // Move submenu placement when ignore used in top right menu
  const dropdownItems: MenuItemProps[] = [
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
    {
      key: 'for',
      label: t('For\u2026'),
      isSubmenu: true,
      children: [
        ...IGNORE_DURATIONS.map(duration => ({
          key: `for-${duration}`,
          label: getDuration(duration * 60),
          onAction: () => onIgnore({ignoreDuration: duration}),
        })),
        {
          key: 'for-custom',
          label: t('Custom'),
          onAction: () => openCustomIgnoreDuration(),
        },
      ],
    },
    {
      key: 'until-reoccur',
      label: t('Until this occurs again\u2026'),
      isSubmenu: true,
      children: [
        ...IGNORE_COUNTS.map(count => ({
          key: `until-reoccur-${count}-times`,
          label:
            count === 1
              ? t('one time\u2026') // This is intentional as unbalanced string formatters are problematic
              : tn('%s time\u2026', '%s times\u2026', count),
          isSubmenu: true,
          children: [
            {
              key: `until-reoccur-${count}-times-from-now`,
              label: t('from now'),
              onAction: () => onIgnore({ignoreCount: count}),
            },
            ...IGNORE_WINDOWS.map(({value, label}) => ({
              key: `until-reoccur-${count}-times-from-${label}`,
              label,
              onAction: () =>
                onIgnore({
                  ignoreCount: count,
                  ignoreWindow: value,
                }),
            })),
          ],
        })),
        {
          key: 'until-reoccur-custom',
          label: t('Custom'),
          onAction: () => openCustomIgnoreCount(),
        },
      ],
    },
    {
      key: 'until-affect',
      label: t('Until this affects an additional\u2026'),
      isSubmenu: true,
      children: [
        ...IGNORE_COUNTS.map(count => ({
          key: `until-affect-${count}-users`,
          label:
            count === 1
              ? t('one user\u2026') // This is intentional as unbalanced string formatters are problematic
              : tn('%s user\u2026', '%s users\u2026', count),
          isSubmenu: true,
          children: [
            {
              key: `until-affect-${count}-users-from-now`,
              label: t('from now'),
              onAction: () => onIgnore({ignoreUserCount: count}),
            },
            ...IGNORE_WINDOWS.map(({value, label}) => ({
              key: `until-affect-${count}-users-from-${label}`,
              label,
              onAction: () =>
                onIgnore({
                  ignoreUserCount: count,
                  ignoreUserWindow: value,
                }),
            })),
          ],
        })),
        {
          key: 'until-affect-custom',
          label: t('Custom'),
          onAction: () => openCustomIgnoreUserCount(),
        },
      ],
    },
  ];

  return {
    onArchive,
    dropdownItems: dropdownItems.filter(item => {
      if (disableArchiveUntilOccurrence) {
        return item.key !== 'until-reoccur' && item.key !== 'until-affect';
      }
      return true;
    }),
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
    <ButtonBar merged gap="0">
      <ArchiveButton
        size={size}
        className={className}
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
        size="sm"
        className={className}
        minMenuWidth={270}
        trigger={(triggerProps, isOpen) => (
          <DropdownTrigger
            {...triggerProps}
            aria-label={t('Archive options')}
            size={size}
            icon={
              <IconChevron variant="muted" direction={isOpen ? 'up' : 'down'} size="xs" />
            }
            disabled={disabled}
          />
        )}
        menuTitle={
          <Flex justify="between" align="center">
            {t('Archive')}
            <StyledExternalLink href="https://docs.sentry.io/product/issues/states-triage/#archive">
              {t('Read the docs')}
            </StyledExternalLink>
          </Flex>
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
  border-radius: ${p => p.theme.radius.md} 0 0 ${p => p.theme.radius.md};
`;

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0;
  border-left: none;
`;

const StyledExternalLink = styled(ExternalLink)`
  font-weight: ${p => p.theme.fontWeight.normal};
`;
