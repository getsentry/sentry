import {useState} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {openConfirmModal} from 'sentry/components/confirm';
import CustomIgnoreCountModal from 'sentry/components/customIgnoreCountModal';
import CustomIgnoreDurationModal from 'sentry/components/customIgnoreDurationModal';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import type {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import Duration from 'sentry/components/duration';
import Tooltip from 'sentry/components/tooltip';
import {IconChevron, IconMute} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {
  GroupStatusResolution,
  ResolutionStatus,
  ResolutionStatusDetails,
  SelectValue,
} from 'sentry/types';

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

function countTimes(count: number) {
  return count === 1
    ? t('one time\u2026') // This is intentional as unbalanced string formatters are problematic
    : tn('%s time\u2026', '%s times\u2026', count);
}

function countUsers(count: number) {
  return count === 1
    ? t('one user\u2026') // This is intentional as unbalanced string formatters are problematic
    : tn('%s user\u2026', '%s users\u2026', count);
}

type Props = {
  onUpdate: (params: GroupStatusResolution) => void;
  confirmLabel?: string;
  confirmMessage?: (statusDetails?: ResolutionStatusDetails) => React.ReactNode;
  disabled?: boolean;
  isIgnored?: boolean;
  shouldConfirm?: boolean;
  size?: 'xs' | 'sm';
};

const IgnoreActions = ({
  onUpdate,
  disabled,
  shouldConfirm,
  confirmMessage,
  confirmLabel = t('Ignore'),
  isIgnored = false,
  size = 'xs',
}: Props) => {
  const [currentSubmenu, setCurrentSubmenu] = useState<null | string>(null);
  const [isOpen, setIsOpen] = useState(false);
  const onIgnore = (statusDetails: ResolutionStatusDetails = {}) => {
    openConfirmModal({
      bypass: !shouldConfirm,
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
    onIgnore(statusDetails);
  };

  if (isIgnored) {
    return (
      <Tooltip title={t('Change status to unresolved')}>
        <Button
          priority="primary"
          size={size}
          onClick={() =>
            onUpdate({status: ResolutionStatus.UNRESOLVED, statusDetails: {}})
          }
          aria-label={t('Unignore')}
          icon={<IconMute size={size} />}
        />
      </Tooltip>
    );
  }

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

  const dropdownItems: MenuItemProps[] = [
    {
      key: 'for',
      label: t('For\u2026'),
      onAction: () => setCurrentSubmenu('for'),
    },
    {
      key: 'until-reoccur',
      label: t('Until this occurs again\u2026'),
      onAction: () => setCurrentSubmenu('until-reoccur'),
    },
    {
      key: 'until-affect',
      label: t('Until this affects an additional\u2026'),
      onAction: () => setCurrentSubmenu('until-affect'),
    },
  ];

  const submenu: Record<string, {submenu: MenuItemProps[]; title: string}> = {
    for: {
      title: t('Ignore for\u2026'),
      submenu: [
        ...IGNORE_DURATIONS.map(duration => ({
          key: `for-${duration}`,
          label: <Duration seconds={duration * 60} />,
          onAction: () => onIgnore({ignoreDuration: duration}),
        })),
        {
          key: 'for-custom',
          label: t('Custom'),
          onAction: () => openCustomIgnoreDuration(),
        },
      ],
    },
    'until-affect': {
      title: t('Ignore until this affects an additional\u2026'),
      submenu: [
        ...IGNORE_COUNTS.map(count => ({
          key: `until-affect-${count}-users`,
          label: countUsers(count),
          onAction: () => setCurrentSubmenu(`until-affect-${count}-users`),
        })),
        {
          key: 'until-affect-custom',
          label: t('Custom'),
          onAction: () => openCustomIgnoreUserCount(),
        },
      ],
    },
    'until-reoccur': {
      title: t('Ignore until this occurs again\u2026'),
      submenu: [
        ...IGNORE_COUNTS.map(count => ({
          key: `until-reoccur-${count}-times`,
          label: countTimes(count),
          onAction: () => setCurrentSubmenu(`until-reoccur-${count}-times`),
        })),
        {
          key: 'until-reoccur-custom',
          label: t('Custom'),
          onAction: () => openCustomIgnoreCount(),
        },
      ],
    },
    ...IGNORE_COUNTS.reduce((acc, count) => {
      acc[`until-reoccur-${count}-times`] = {
        title: t('Ignore until this occurs again %s', countTimes(count)),
        submenu: [
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
      };
      acc[`until-affect-${count}-users`] = {
        title: t('Ignore until this affects an additional %s', countUsers(count)),
        submenu: [
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
      };
      return acc;
    }, {}),
  };

  return (
    <ButtonBar merged>
      <IgnoreButton size={size} onClick={() => onIgnore()} disabled={disabled}>
        {t('Ignore')}
      </IgnoreButton>
      <DropdownMenuControl
        size={size}
        placement="bottom right"
        closeOnSelect={false}
        isOpen={isOpen}
        closeRootMenu={() => {
          setIsOpen(false);
          setCurrentSubmenu(null);
        }}
        trigger={({props: triggerProps, ref: triggerRef}) => (
          <DropdownTrigger
            ref={triggerRef}
            {...triggerProps}
            aria-label={t('Ignore options')}
            size={size}
            icon={<IconChevron direction="down" size={size} />}
            disabled={disabled}
            onClick={() => {
              setIsOpen(!isOpen);
              setCurrentSubmenu(null);
            }}
          />
        )}
        menuTitle={
          <DropdownTitleWrapper>
            {currentSubmenu ? submenu[currentSubmenu].title : t('Ignore')}
          </DropdownTitleWrapper>
        }
        items={currentSubmenu ? submenu[currentSubmenu].submenu : dropdownItems}
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

const DropdownTitleWrapper = styled('div')`
  width: 260px;
  white-space: normal;
`;

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusRight};
  border-left: none;
`;
