import * as React from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {openConfirmModal} from 'sentry/components/confirm';
import CustomIgnoreCountModal from 'sentry/components/customIgnoreCountModal';
import CustomIgnoreDurationModal from 'sentry/components/customIgnoreDurationModal';
import DropdownMenuControlV2 from 'sentry/components/dropdownMenuControlV2';
import Duration from 'sentry/components/duration';
import Tooltip from 'sentry/components/tooltip';
import {IconChevron, IconMute} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {
  ResolutionStatus,
  ResolutionStatusDetails,
  SelectValue,
  UpdateResolutionStatus,
} from 'sentry/types';

const IGNORE_DURATIONS = [30, 120, 360, 60 * 24, 60 * 24 * 7];
const IGNORE_COUNTS = [1, 10, 100, 1000, 10000, 100000];
const IGNORE_WINDOWS: SelectValue<number>[] = [
  {value: 60, label: t('per hour')},
  {value: 24 * 60, label: t('per day')},
  {value: 24 * 7 * 60, label: t('per week')},
];

type Props = {
  onUpdate: (params: UpdateResolutionStatus) => void;
  disabled?: boolean;
  shouldConfirm?: boolean;
  confirmMessage?: React.ReactNode;
  confirmLabel?: string;
  isIgnored?: boolean;
};

const IgnoreActions = ({
  onUpdate,
  disabled,
  shouldConfirm,
  confirmMessage,
  confirmLabel = t('Ignore'),
  isIgnored = false,
}: Props) => {
  const onIgnore = (statusDetails: ResolutionStatusDetails) => {
    if (shouldConfirm) {
      openConfirmModal({
        onConfirm: () =>
          onUpdate({
            status: ResolutionStatus.IGNORED,
            statusDetails: statusDetails || {},
          }),
        message: confirmMessage,
        confirmText: confirmLabel,
      });
    } else {
      onUpdate({
        status: ResolutionStatus.IGNORED,
        statusDetails: statusDetails || {},
      });
    }
  };

  const onCustomIgnore = (statusDetails: ResolutionStatusDetails) => {
    onIgnore(statusDetails);
  };

  const actionLinkProps = {
    shouldConfirm,
    title: t('Ignore'),
    message: confirmMessage,
    confirmLabel,
    disabled,
  };

  if (isIgnored) {
    return (
      <Tooltip title={t('Change status to unresolved')}>
        <Button
          priority="primary"
          size="xsmall"
          onClick={() => onUpdate({status: ResolutionStatus.UNRESOLVED})}
          aria-label={t('Unignore')}
          icon={<IconMute size="xs" />}
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

  const dropdownItems = [
    {
      key: 'for',
      label: t('For\u2026'),
      isSubmenu: true,
      children: [
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
          key: 'for-custom',
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
          key: 'for-custom',
          label: t('Custom'),
          onAction: () => openCustomIgnoreUserCount(),
        },
      ],
    },
  ];

  return (
    <ButtonBar merged>
      <IgnoreButton
        {...actionLinkProps}
        size="xsmall"
        tooltipProps={{delay: 300}}
        title={t(
          'Silences alerts for this issue and removes it from the issue stream by default.'
        )}
        onClick={() => onUpdate({status: ResolutionStatus.IGNORED})}
        icon={<IconMute size="xs" />}
      >
        {t('Ignore')}
      </IgnoreButton>
      <DropdownMenuControlV2
        trigger={({props: triggerProps, ref: triggerRef}) => (
          <DropdownTrigger
            ref={triggerRef}
            {...triggerProps}
            size="xsmall"
            aria-label={t('Ignore options')}
            icon={<IconChevron direction="down" size="xs" />}
            disabled={disabled}
          />
        )}
        menuTitle={t('Ignore')}
        items={dropdownItems}
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
