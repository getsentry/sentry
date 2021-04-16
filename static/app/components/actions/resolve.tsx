import React from 'react';

import {openModal} from 'app/actionCreators/modal';
import ActionLink from 'app/components/actions/actionLink';
import ButtonBar from 'app/components/buttonBar';
import CustomResolutionModal from 'app/components/customResolutionModal';
import DropdownLink from 'app/components/dropdownLink';
import Tooltip from 'app/components/tooltip';
import {IconCheckmark, IconChevron} from 'app/icons';
import {t} from 'app/locale';
import {
  Release,
  ResolutionStatus,
  ResolutionStatusDetails,
  UpdateResolutionStatus,
} from 'app/types';
import {formatVersion} from 'app/utils/formatters';

import ActionButton from './button';
import MenuHeader from './menuHeader';
import MenuItemActionLink from './menuItemActionLink';

const defaultProps = {
  isResolved: false,
  isAutoResolved: false,
  confirmLabel: t('Resolve'),
  hasInbox: false,
};

type Props = {
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
  hasInbox?: boolean;
} & typeof defaultProps;

class ResolveActions extends React.Component<Props> {
  static defaultProps = defaultProps;

  onCustomResolution(statusDetails: ResolutionStatusDetails) {
    this.props.onUpdate({
      status: ResolutionStatus.RESOLVED,
      statusDetails,
    });
  }

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
      onUpdate,
      confirmMessage,
      shouldConfirm,
      disabled,
      confirmLabel,
      disableDropdown,
      hasInbox,
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
          !hasInbox && (
            <ActionButton
              label={t('More resolve options')}
              disabled={!projectSlug ? disabled : disableDropdown}
              icon={<IconChevron direction="down" size="xs" />}
            />
          )
        }
        caret={false}
        title={hasInbox && t('Resolve In\u2026')}
        alwaysRenderMenu
        disabled={!projectSlug ? disabled : disableDropdown}
        anchorRight={hasInbox}
        isNestedDropdown={hasInbox}
      >
        <MenuHeader>{t('Resolved In')}</MenuHeader>

        <MenuItemActionLink
          {...actionLinkProps}
          title={t('The next release')}
          onAction={() =>
            hasRelease &&
            onUpdate({
              status: ResolutionStatus.RESOLVED,
              statusDetails: {
                inNextRelease: true,
              },
            })
          }
        >
          <Tooltip disabled={hasRelease} title={actionTitle}>
            {t('The next release')}
          </Tooltip>
        </MenuItemActionLink>

        <MenuItemActionLink
          {...actionLinkProps}
          title={t('The current release')}
          onAction={() =>
            hasRelease &&
            onUpdate({
              status: ResolutionStatus.RESOLVED,
              statusDetails: {
                inRelease: latestRelease ? latestRelease.version : 'latest',
              },
            })
          }
        >
          <Tooltip disabled={hasRelease} title={actionTitle}>
            {latestRelease
              ? t('The current release (%s)', formatVersion(latestRelease.version))
              : t('The current release')}
          </Tooltip>
        </MenuItemActionLink>

        <MenuItemActionLink
          {...actionLinkProps}
          title={t('Another version')}
          onAction={() => hasRelease && this.openCustomReleaseModal()}
          shouldConfirm={false}
        >
          <Tooltip disabled={hasRelease} title={actionTitle}>
            {t('Another version\u2026')}
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
          this.onCustomResolution(statusDetails)
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
      hasInbox,
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
        {hasInbox ? (
          <div style={{width: '100%'}}>
            <div className="dropdown-submenu flex expand-left">
              {this.renderDropdownMenu()}
            </div>
          </div>
        ) : (
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
        )}
      </Tooltip>
    );
  }
}

export default ResolveActions;
