import {Component} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {openConfirmModal} from 'sentry/components/confirm';
import CustomCommitsResolutionModal from 'sentry/components/customCommitsResolutionModal';
import CustomResolutionModal from 'sentry/components/customResolutionModal';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import type {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import Tooltip from 'sentry/components/tooltip';
import {IconCheckmark, IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  GroupStatusResolution,
  Organization,
  Release,
  ResolutionStatus,
  ResolutionStatusDetails,
} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {formatVersion} from 'sentry/utils/formatters';
import withOrganization from 'sentry/utils/withOrganization';

const defaultProps = {
  isResolved: false,
  isAutoResolved: false,
  confirmLabel: t('Resolve'),
};

type Props = {
  hasRelease: boolean;
  onUpdate: (data: GroupStatusResolution) => void;
  orgSlug: string;
  organization: Organization;
  confirmMessage?: React.ReactNode;
  disableDropdown?: boolean;
  disableTooltip?: boolean;
  disabled?: boolean;
  hideIcon?: boolean;
  latestRelease?: Release;
  priority?: 'primary';
  projectFetchError?: boolean;
  projectSlug?: string;
  shouldConfirm?: boolean;
  size?: 'xs' | 'sm';
} & Partial<typeof defaultProps>;

class ResolveActions extends Component<Props> {
  static defaultProps = defaultProps;

  handleCommitResolution(statusDetails: ResolutionStatusDetails) {
    const {onUpdate} = this.props;
    onUpdate({
      status: ResolutionStatus.RESOLVED,
      statusDetails,
    });
  }

  handleAnotherExistingReleaseResolution(statusDetails: ResolutionStatusDetails) {
    const {organization, onUpdate} = this.props;
    onUpdate({
      status: ResolutionStatus.RESOLVED,
      statusDetails,
    });
    trackAdvancedAnalyticsEvent('resolve_issue', {
      organization,
      release: 'anotherExisting',
    });
  }

  handleCurrentReleaseResolution = () => {
    const {onUpdate, organization, hasRelease, latestRelease} = this.props;
    hasRelease &&
      onUpdate({
        status: ResolutionStatus.RESOLVED,
        statusDetails: {
          inRelease: latestRelease ? latestRelease.version : 'latest',
        },
      });
    trackAdvancedAnalyticsEvent('resolve_issue', {
      organization,
      release: 'current',
    });
  };

  handleNextReleaseResolution = () => {
    const {onUpdate, organization, hasRelease} = this.props;
    hasRelease &&
      onUpdate({
        status: ResolutionStatus.RESOLVED,
        statusDetails: {
          inNextRelease: true,
        },
      });
    trackAdvancedAnalyticsEvent('resolve_issue', {
      organization,
      release: 'next',
    });
  };

  renderResolved() {
    const {isAutoResolved, onUpdate} = this.props;

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

  renderDropdownMenu() {
    const {
      projectSlug,
      isResolved,
      hasRelease,
      latestRelease,
      confirmMessage,
      shouldConfirm,
      disabled,
      confirmLabel,
      disableDropdown,
      size = 'xs',
      priority,
    } = this.props;

    if (isResolved) {
      return this.renderResolved();
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
        onAction: () => onActionOrConfirm(this.handleNextReleaseResolution),
        showDividers: !actionTitle,
      },
      {
        key: 'current-release',
        label: latestRelease
          ? t('The current release (%s)', formatVersion(latestRelease.version))
          : t('The current release'),
        details: actionTitle,
        onAction: () => onActionOrConfirm(this.handleCurrentReleaseResolution),
        showDividers: !actionTitle,
      },
      {
        key: 'another-release',
        label: t('Another existing release\u2026'),
        onAction: () => this.openCustomReleaseModal(),
        showDividers: !actionTitle,
      },
      {
        key: 'a-commit',
        label: t('A commit\u2026'),
        onAction: () => this.openCustomCommitModal(),
        showDividers: !actionTitle,
      },
    ];

    const isDisabled = !projectSlug ? disabled : disableDropdown;

    return (
      <DropdownMenuControl
        items={items}
        trigger={triggerProps => (
          <DropdownTrigger
            {...triggerProps}
            type="button"
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

  openCustomCommitModal() {
    const {orgSlug, projectSlug} = this.props;

    openModal(deps => (
      <CustomCommitsResolutionModal
        {...deps}
        onSelected={(statusDetails: ResolutionStatusDetails) =>
          this.handleCommitResolution(statusDetails)
        }
        orgSlug={orgSlug}
        projectSlug={projectSlug}
      />
    ));
  }

  openCustomReleaseModal() {
    const {orgSlug, projectSlug} = this.props;

    openModal(deps => (
      <CustomResolutionModal
        {...deps}
        onSelected={(statusDetails: ResolutionStatusDetails) =>
          this.handleAnotherExistingReleaseResolution(statusDetails)
        }
        orgSlug={orgSlug}
        projectSlug={projectSlug}
      />
    ));
  }

  render() {
    const {
      isResolved,
      onUpdate,
      confirmMessage,
      shouldConfirm,
      disabled,
      confirmLabel,
      projectFetchError,
      disableTooltip,
      priority,
      size = 'xs',
      hideIcon = false,
    } = this.props;

    if (isResolved) {
      return this.renderResolved();
    }

    const onResolve = () =>
      openConfirmModal({
        bypass: !shouldConfirm,
        onConfirm: () => onUpdate({status: ResolutionStatus.RESOLVED, statusDetails: {}}),
        message: confirmMessage,
        confirmText: confirmLabel,
      });

    return (
      <Tooltip disabled={!projectFetchError} title={t('Error fetching project')}>
        <ButtonBar merged>
          <ResolveButton
            type="button"
            priority={priority}
            size={size}
            title={t(
              'Resolves the issue. The issue will get unresolved if it happens again.'
            )}
            tooltipProps={{delay: 300, disabled: disabled || disableTooltip}}
            icon={hideIcon ? null : <IconCheckmark size={size} />}
            onClick={onResolve}
            disabled={disabled}
          >
            {t('Resolve')}
          </ResolveButton>
          {this.renderDropdownMenu()}
        </ButtonBar>
      </Tooltip>
    );
  }
}

export default withOrganization(ResolveActions);

const ResolveButton = styled(Button)<{priority?: 'primary'}>`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusLeft};
  ${p => (p.priority === 'primary' ? `border-right-color: ${p.theme.background};` : '')}
`;

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusRight};
  border-left: none;
`;
