import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {openConfirmModal} from 'sentry/components/confirm';
import CustomIgnoreCountModal from 'sentry/components/customIgnoreCountModal';
import CustomIgnoreDurationModal from 'sentry/components/customIgnoreDurationModal';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import type {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import Tooltip from 'sentry/components/tooltip';
import {IconChevron, IconMute} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {
  GroupStatusResolution,
  ResolutionStatus,
  ResolutionStatusDetails,
  SelectValue,
} from 'sentry/types';
import {getDuration} from 'sentry/utils/formatters';

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

const IGNORE_WINDOWS: SelectValue<number>[] = [
  {value: ONE_HOUR, label: t('per hour')},
  {value: ONE_HOUR * 24, label: t('per day')},
  {value: ONE_HOUR * 24 * 7, label: t('per week')},
];

/**
 * Create the dropdown submenus
 */
export function getIgnoreActions({
  confirmLabel,
  confirmMessage,
  shouldConfirm,
  onUpdate,
}: Pick<
  IgnoreActionProps,
  'shouldConfirm' | 'confirmMessage' | 'confirmLabel' | 'onUpdate'
>) {
  const onIgnore = (
    statusDetails: ResolutionStatusDetails | undefined = {},
    {bypassConfirm} = {bypassConfirm: false}
  ) => {
    openConfirmModal({
      bypass: bypassConfirm || !shouldConfirm,
      onConfirm: () =>
        onUpdate({
          status: ResolutionStatus.IGNORED,
          statusDetails,
        }),
      message: confirmMessage?.(statusDetails) ?? null,
      confirmText: confirmLabel,
    });
  };

  const onCustomIgnore = (statusDetails: ResolutionStatusDetails) => {
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
        label={t('Ignore this issue until it occurs again\u2026')}
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
        label={t('Ignore this issue until it affects an additional\u2026')}
        countLabel={t('Number of users')}
        countName="ignoreUserCount"
        windowName="ignoreUserWindow"
        windowOptions={IGNORE_WINDOWS}
      />
    ));

  // Move submenu placement when ignore used in top right menu
  const dropdownItems: MenuItemProps[] = [
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
  return {dropdownItems, onIgnore};
}

type IgnoreActionProps = {
  onUpdate: (params: GroupStatusResolution) => void;
  className?: string;
  confirmLabel?: string;
  confirmMessage?: (
    statusDetails: ResolutionStatusDetails | undefined
  ) => React.ReactNode;
  disableTooltip?: boolean;
  disabled?: boolean;
  hideIcon?: boolean;
  isIgnored?: boolean;
  shouldConfirm?: boolean;
  size?: 'xs' | 'sm';
};

const IgnoreActions = ({
  onUpdate,
  disabled,
  shouldConfirm,
  confirmMessage,
  className,
  hideIcon,
  disableTooltip,
  size = 'xs',
  confirmLabel = t('Ignore'),
  isIgnored = false,
}: IgnoreActionProps) => {
  if (isIgnored) {
    return (
      <Tooltip title={t('Change status to unresolved')}>
        <Button
          priority="primary"
          size="xs"
          onClick={() =>
            onUpdate({status: ResolutionStatus.UNRESOLVED, statusDetails: {}})
          }
          aria-label={t('Unignore')}
          icon={<IconMute size="xs" />}
        />
      </Tooltip>
    );
  }

  const {dropdownItems, onIgnore} = getIgnoreActions({
    confirmLabel,
    onUpdate,
    shouldConfirm,
    confirmMessage,
  });

  return (
    <ButtonBar className={className} merged>
      <IgnoreButton
        size={size}
        tooltipProps={{delay: 300, disabled: disabled || disableTooltip}}
        title={t(
          'Silences alerts for this issue and removes it from the issue stream by default.'
        )}
        icon={hideIcon ? null : <IconMute size={size} />}
        onClick={() => onIgnore()}
        disabled={disabled}
      >
        {t('Ignore')}
      </IgnoreButton>
      <DropdownMenuControl
        size="sm"
        trigger={triggerProps => (
          <DropdownTrigger
            {...triggerProps}
            aria-label={t('Ignore options')}
            size={size}
            icon={<IconChevron direction="down" size="xs" />}
            disabled={disabled}
          />
        )}
        menuTitle={t('Ignore')}
        items={dropdownItems}
        isDisabled={disabled}
      />
    </ButtonBar>
  );
};

export default IgnoreActions;

const IgnoreButton = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusLeft};
`;

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusRight};
  border-left: none;
`;
