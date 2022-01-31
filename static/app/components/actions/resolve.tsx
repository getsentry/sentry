import * as React from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import ActionLink from 'sentry/components/actions/actionLink';
import ButtonBar from 'sentry/components/buttonBar';
import CustomResolutionModal from 'sentry/components/customResolutionModal';
import DropdownLink from 'sentry/components/dropdownLink';
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

import ActionButton from './button';
import MenuHeader from './menuHeader';
import MenuItemActionLink from './menuItemActionLink';

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

class ResolveActions extends React.Component<Props> {
  static defaultProps = defaultProps;

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
        <ActionButton
          priority="primary"
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

    const actionLinkProps = {
      shouldConfirm,
      message: confirmMessage,
      confirmLabel,
      disabled: disabled || !hasRelease,
    };

    return (
      <DropdownLink
        customTitle={
          <StyledActionButton
            aria-label={t('More resolve options')}
            disabled={!projectSlug ? disabled : disableDropdown}
            icon={<IconChevron direction="down" size="xs" />}
          />
        }
        caret={false}
        alwaysRenderMenu
        disabled={!projectSlug ? disabled : disableDropdown}
      >
        <MenuHeader>{t('Resolved In')}</MenuHeader>

        <MenuItemActionLink
          {...actionLinkProps}
          title={t('The next release')}
          onAction={this.handleNextReleaseResolution}
        >
          <Tooltip disabled={hasRelease} title={actionTitle}>
            {t('The next release')}
          </Tooltip>
        </MenuItemActionLink>

        <MenuItemActionLink
          {...actionLinkProps}
          title={t('The current release')}
          onAction={this.handleCurrentReleaseResolution}
        >
          <Tooltip disabled={hasRelease} title={actionTitle}>
            {latestRelease
              ? t('The current release (%s)', formatVersion(latestRelease.version))
              : t('The current release')}
          </Tooltip>
        </MenuItemActionLink>

        <MenuItemActionLink
          {...actionLinkProps}
          title={t('Another existing release')}
          onAction={() => hasRelease && this.openCustomReleaseModal()}
          shouldConfirm={false}
        >
          <Tooltip disabled={hasRelease} title={actionTitle}>
            {t('Another existing release')}
          </Tooltip>
        </MenuItemActionLink>
      </DropdownLink>
    );
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

    const actionLinkProps = {
      shouldConfirm,
      message: confirmMessage,
      confirmLabel,
      disabled,
    };

    return (
      <Tooltip disabled={!projectFetchError} title={t('Error fetching project')}>
        <ButtonBar merged>
          <Tooltip
            disabled={actionLinkProps.disabled}
            title={t(
              'Resolves the issue. The issue will get unresolved if it happens again.'
            )}
            delay={300}
          >
            <ActionLink
              {...actionLinkProps}
              type="button"
              title={t('Resolve')}
              icon={<IconCheckmark size="xs" />}
              onAction={() => onUpdate({status: ResolutionStatus.RESOLVED})}
              hasDropdown
            >
              {t('Resolve')}
            </ActionLink>
          </Tooltip>
          {this.renderDropdownMenu()}
        </ButtonBar>
      </Tooltip>
    );
  }
}

export default withOrganization(ResolveActions);

const StyledActionButton = styled(ActionButton)`
  box-shadow: none;
`;
