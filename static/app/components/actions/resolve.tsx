import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {openConfirmModal} from 'sentry/components/confirm';
import CustomCommitsResolutionModal from 'sentry/components/customCommitsResolutionModal';
import CustomResolutionModal from 'sentry/components/customResolutionModal';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import {Tooltip} from 'sentry/components/tooltip';
import {IconCheckmark, IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  GroupStatusResolution,
  Release,
  ResolutionStatus,
  ResolutionStatusDetails,
} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatVersion} from 'sentry/utils/formatters';
import useOrganization from 'sentry/utils/useOrganization';

interface ResolveActionsProps {
  hasRelease: boolean;
  onUpdate: (data: GroupStatusResolution) => void;
  confirmLabel?: string;
  confirmMessage?: React.ReactNode;
  disableDropdown?: boolean;
  disableTooltip?: boolean;
  disabled?: boolean;
  hideIcon?: boolean;
  isAutoResolved?: boolean;
  isResolved?: boolean;
  latestRelease?: Release;
  priority?: 'primary';
  projectFetchError?: boolean;
  projectSlug?: string;
  shouldConfirm?: boolean;
  size?: 'xs' | 'sm';
}

function ResolveActions({
  size = 'xs',
  isResolved = false,
  isAutoResolved = false,
  confirmLabel = t('Resolve'),
  projectSlug,
  hasRelease,
  latestRelease,
  confirmMessage,
  shouldConfirm,
  disabled,
  disableDropdown,
  priority,
  hideIcon,
  projectFetchError,
  disableTooltip,
  onUpdate,
}: ResolveActionsProps) {
  const organization = useOrganization();

  function handleCommitResolution(statusDetails: ResolutionStatusDetails) {
    onUpdate({
      status: ResolutionStatus.RESOLVED,
      statusDetails,
    });
  }

  function handleAnotherExistingReleaseResolution(
    statusDetails: ResolutionStatusDetails
  ) {
    onUpdate({
      status: ResolutionStatus.RESOLVED,
      statusDetails,
    });
    trackAnalytics('resolve_issue', {
      organization,
      release: 'anotherExisting',
    });
  }

  function handleCurrentReleaseResolution() {
    if (hasRelease) {
      onUpdate({
        status: ResolutionStatus.RESOLVED,
        statusDetails: {
          inRelease: latestRelease ? latestRelease.version : 'latest',
        },
      });
    }

    trackAnalytics('resolve_issue', {
      organization,
      release: 'current',
    });
  }

  function handleNextReleaseResolution() {
    if (hasRelease) {
      onUpdate({
        status: ResolutionStatus.RESOLVED,
        statusDetails: {
          inNextRelease: true,
        },
      });
    }

    trackAnalytics('resolve_issue', {
      organization,
      release: 'next',
    });
  }

  function renderResolved() {
    return (
      <Tooltip
        title={
          isAutoResolved
            ? t(
                'This event is resolved due to the Auto Resolve configuration for this project'
              )
            : t('Unresolve')
        }
      >
        <Button
          priority="primary"
          size="xs"
          icon={<IconCheckmark size="xs" />}
          aria-label={t('Unresolve')}
          disabled={isAutoResolved}
          onClick={() =>
            onUpdate({status: ResolutionStatus.UNRESOLVED, statusDetails: {}})
          }
        />
      </Tooltip>
    );
  }

  function renderDropdownMenu() {
    if (isResolved) {
      return renderResolved();
    }

    const actionTitle = !hasRelease
      ? t('Set up release tracking in order to use this feature.')
      : '';

    const onActionOrConfirm = onAction => {
      openConfirmModal({
        bypass: !shouldConfirm,
        onConfirm: onAction,
        message: confirmMessage,
        confirmText: confirmLabel,
      });
    };

    const items: MenuItemProps[] = [
      {
        key: 'next-release',
        label: t('The next release'),
        details: actionTitle,
        onAction: () => onActionOrConfirm(handleNextReleaseResolution),
      },
      {
        key: 'current-release',
        label: latestRelease
          ? t('The current release (%s)', formatVersion(latestRelease.version))
          : t('The current release'),
        details: actionTitle,
        onAction: () => onActionOrConfirm(handleCurrentReleaseResolution),
      },
      {
        key: 'another-release',
        label: t('Another existing release\u2026'),
        onAction: () => openCustomReleaseModal(),
      },
      {
        key: 'a-commit',
        label: t('A commit\u2026'),
        onAction: () => openCustomCommitModal(),
      },
    ];

    const isDisabled = !projectSlug ? disabled : disableDropdown;

    return (
      <DropdownMenu
        items={items}
        trigger={triggerProps => (
          <DropdownTrigger
            {...triggerProps}
            size={size}
            priority={priority}
            aria-label={t('More resolve options')}
            icon={<IconChevron direction="down" size="xs" />}
            disabled={isDisabled}
          />
        )}
        disabledKeys={
          disabled || !hasRelease
            ? ['next-release', 'current-release', 'another-release']
            : []
        }
        menuTitle={t('Resolved In')}
        isDisabled={isDisabled}
      />
    );
  }

  function openCustomCommitModal() {
    openModal(deps => (
      <CustomCommitsResolutionModal
        {...deps}
        onSelected={(statusDetails: ResolutionStatusDetails) =>
          handleCommitResolution(statusDetails)
        }
        orgSlug={organization.slug}
        projectSlug={projectSlug}
      />
    ));
  }

  function openCustomReleaseModal() {
    openModal(deps => (
      <CustomResolutionModal
        {...deps}
        onSelected={(statusDetails: ResolutionStatusDetails) =>
          handleAnotherExistingReleaseResolution(statusDetails)
        }
        orgSlug={organization.slug}
        projectSlug={projectSlug}
      />
    ));
  }

  if (isResolved) {
    return renderResolved();
  }

  return (
    <Tooltip disabled={!projectFetchError} title={t('Error fetching project')}>
      <ButtonBar merged>
        <ResolveButton
          priority={priority}
          size={size}
          title={t(
            'Resolves the issue. The issue will get unresolved if it happens again.'
          )}
          tooltipProps={{delay: 300, disabled: disabled || disableTooltip}}
          icon={hideIcon ? null : <IconCheckmark size={size} />}
          onClick={() =>
            openConfirmModal({
              bypass: !shouldConfirm,
              onConfirm: () =>
                onUpdate({status: ResolutionStatus.RESOLVED, statusDetails: {}}),
              message: confirmMessage,
              confirmText: confirmLabel,
            })
          }
          disabled={disabled}
        >
          {t('Resolve')}
        </ResolveButton>
        {renderDropdownMenu()}
      </ButtonBar>
    </Tooltip>
  );
}

export default ResolveActions;

const ResolveButton = styled(Button)<{priority?: 'primary'}>`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusLeft};
  ${p =>
    p.priority === 'primary' &&
    css`
      &::after {
        content: '';
        position: absolute;
        top: -1px;
        bottom: -1px;
        right: -1px;
        border-right: solid 1px currentColor;
        opacity: 0.25;
      }
    `}
`;

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusRight};
  border-left: none;
`;
