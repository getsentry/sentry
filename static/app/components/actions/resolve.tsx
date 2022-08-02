import {Component} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import Button from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {openConfirmModal} from 'sentry/components/confirm';
import CustomCommitsResolutionModal from 'sentry/components/customCommitsResolutionModal';
import CustomResolutionModal from 'sentry/components/customResolutionModal';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import Tooltip from 'sentry/components/tooltip';
import {IconCheckmark, IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  Organization,
  Release,
  ResolutionStatus,
  ResolutionStatusDetails,
  UpdateResolutionStatus,
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
  onUpdate: (data: UpdateResolutionStatus) => void;
  orgSlug: string;
  organization: Organization;
  confirmMessage?: React.ReactNode;
  disableDropdown?: boolean;
  disabled?: boolean;
  latestRelease?: Release;
  projectFetchError?: boolean;
  projectSlug?: string;
  shouldConfirm?: boolean;
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
          onClick={() => onUpdate({status: ResolutionStatus.UNRESOLVED})}
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

    const items = [
      {
        key: 'next-release',
        label: t('The next release'),
        details: actionTitle,
        onAction: () => onActionOrConfirm(this.handleNextReleaseResolution),
        showDividers: !hasRelease,
      },
      {
        key: 'current-release',
        label: latestRelease
          ? t('The current release (%s)', formatVersion(latestRelease.version))
          : t('The current release'),
        details: actionTitle,
        onAction: () => onActionOrConfirm(this.handleCurrentReleaseResolution),
        showDividers: !hasRelease,
      },
      {
        key: 'another-release',
        label: t('Another existing release\u2026'),
        onAction: () => this.openCustomReleaseModal(),
      },
      {
        key: 'a-commit',
        label: t('A commit\u2026'),
        onAction: () => this.openCustomCommitModal(),
      },
    ];

    const isDisabled = !projectSlug ? disabled : disableDropdown;

    return (
      <DropdownMenuControl
        items={items}
        trigger={({props: triggerProps, ref: triggerRef}) => (
          <DropdownTrigger
            ref={triggerRef}
            {...triggerProps}
            aria-label={t('More resolve options')}
            size="xs"
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
    } = this.props;

    if (isResolved) {
      return this.renderResolved();
    }

    const onResolve = () =>
      openConfirmModal({
        bypass: !shouldConfirm,
        onConfirm: () => onUpdate({status: ResolutionStatus.RESOLVED}),
        message: confirmMessage,
        confirmText: confirmLabel,
      });

    return (
      <Tooltip disabled={!projectFetchError} title={t('Error fetching project')}>
        <ButtonBar merged>
          <ResolveButton
            size="xs"
            title={t(
              'Resolves the issue. The issue will get unresolved if it happens again.'
            )}
            tooltipProps={{delay: 300, disabled}}
            icon={<IconCheckmark size="xs" />}
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

const ResolveButton = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusLeft};
`;

const DropdownTrigger = styled(Button)`
  box-shadow: none;
  border-radius: ${p => p.theme.borderRadiusRight};
  border-left: none;
`;
