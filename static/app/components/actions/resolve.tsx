import * as React from 'react';

import {openModal} from 'app/actionCreators/modal';
import ActionLink from 'app/components/actions/actionLink';
import ButtonBar from 'app/components/buttonBar';
import CustomResolutionModal from 'app/components/customResolutionModal';
import DropdownLink from 'app/components/dropdownLink';
import Tooltip from 'app/components/tooltip';
import {IconCheckmark, IconChevron} from 'app/icons';
import {t} from 'app/locale';
import {
  Organization,
  Release,
  ResolutionStatus,
  ResolutionStatusDetails,
  UpdateResolutionStatus,
} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {formatVersion} from 'app/utils/formatters';
import withOrganization from 'app/utils/withOrganization';

import ActionButton from './button';
import MenuHeader from './menuHeader';
import MenuItemActionLink from './menuItemActionLink';

const defaultProps = {
  isResolved: false,
  isAutoResolved: false,
  confirmLabel: t('Resolve'),
};

type Props = {
  organization: Organization;
  hasRelease: boolean;
  onUpdate: (data: UpdateResolutionStatus) => void;
  orgSlug: string;
  latestRelease?: Release;
  projectSlug?: string;
  shouldConfirm?: boolean;
  confirmMessage?: React.ReactNode;
  disabled?: boolean;
  disableDropdown?: boolean;
  projectFetchError?: boolean;
} & Partial<typeof defaultProps>;

class ResolveActions extends React.Component<Props> {
  static defaultProps = defaultProps;

  handleAnotherExistingReleaseResolution(statusDetails: ResolutionStatusDetails) {
    const {organization, onUpdate} = this.props;
    onUpdate({
      status: ResolutionStatus.RESOLVED,
      statusDetails,
    });
    trackAnalyticsEvent({
      eventKey: 'resolve_issue',
      eventName: 'Resolve Issue',
      release: 'anotherExisting',
      organization_id: organization.id,
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
    trackAnalyticsEvent({
      eventKey: 'resolve_issue',
      eventName: 'Resolve Issue',
      release: 'current',
      organization_id: organization.id,
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
    trackAnalyticsEvent({
      eventKey: 'resolve_issue',
      eventName: 'Resolve Issue',
      release: 'next',
      organization_id: organization.id,
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
          label={t('Unresolve')}
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
          <ActionButton
            label={t('More resolve options')}
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
          <ActionLink
            {...actionLinkProps}
            type="button"
            title={t('Resolve')}
            icon={<IconCheckmark size="xs" />}
            onAction={() => onUpdate({status: ResolutionStatus.RESOLVED})}
          >
            {t('Resolve')}
          </ActionLink>
          {this.renderDropdownMenu()}
        </ButtonBar>
      </Tooltip>
    );
  }
}

export default withOrganization(ResolveActions);
