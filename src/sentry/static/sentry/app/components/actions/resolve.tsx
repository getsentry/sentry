import React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import {openModal} from 'app/actionCreators/modal';
import ActionLink from 'app/components/actions/actionLink';
import CustomResolutionModal from 'app/components/customResolutionModal';
import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';
import Tooltip from 'app/components/tooltip';
import {IconCheckmark} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {
  Release,
  ResolutionStatus,
  ResolutionStatusDetails,
  UpdateResolutionStatus,
} from 'app/types';
import {formatVersion} from 'app/utils/formatters';

const defaultProps = {
  isResolved: false,
  isAutoResolved: false,
  confirmLabel: t('Resolve'),
  hasInbox: false,
};

type Props = {
  hasRelease: boolean;
  onUpdate: (data: UpdateResolutionStatus) => void;
  orgId: string;
  latestRelease?: Release;
  projectId?: string;
  shouldConfirm?: boolean;
  confirmMessage?: React.ReactNode;
  disabled?: boolean;
  disableDropdown?: boolean;
  projectFetchError?: boolean;
  hasInbox?: boolean;
} & typeof defaultProps;

class ResolveActions extends React.Component<Props> {
  static propTypes = {
    hasRelease: PropTypes.bool.isRequired,
    latestRelease: PropTypes.object,
    onUpdate: PropTypes.func.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string,
    shouldConfirm: PropTypes.bool,
    confirmMessage: PropTypes.node,
    disabled: PropTypes.bool,
    disableDropdown: PropTypes.bool,
    isResolved: PropTypes.bool,
    isAutoResolved: PropTypes.bool,
    confirmLabel: PropTypes.string,
    projectFetchError: PropTypes.bool,
  };

  static defaultProps = defaultProps;

  onCustomResolution(statusDetails: ResolutionStatusDetails) {
    this.props.onUpdate({
      status: ResolutionStatus.RESOLVED,
      statusDetails,
    });
  }

  getButtonClass(otherClasses?: string) {
    return classNames('btn btn-default btn-sm', otherClasses);
  }

  renderResolved() {
    const {isAutoResolved, onUpdate} = this.props;

    if (isAutoResolved) {
      return (
        <div className="btn-group">
          <Tooltip
            title={t(
              'This event is resolved due to the Auto Resolve configuration for this project'
            )}
          >
            <a className={this.getButtonClass('active')}>
              <IconCheckmark size="xs" />
            </a>
          </Tooltip>
        </div>
      );
    } else {
      return (
        <div className="btn-group">
          <Tooltip title={t('Unresolve')}>
            <a
              data-test-id="button-unresolve"
              className={this.getButtonClass('active')}
              onClick={() => onUpdate({status: ResolutionStatus.UNRESOLVED})}
            >
              <IconCheckmark size="xs" />
            </a>
          </Tooltip>
        </div>
      );
    }
  }

  renderDropdownMenu() {
    const {
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

    const buttonClass = this.getButtonClass();

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
      disabled,
    };

    return (
      <StyledDropdownLink
        caret={!hasInbox}
        className={hasInbox ? undefined : buttonClass}
        title={hasInbox ? t('Resolve In\u2026') : ''}
        alwaysRenderMenu
        disabled={disableDropdown || disabled}
        anchorRight={hasInbox}
        isNestedDropdown={hasInbox}
      >
        <MenuItem header>{t('Resolved In')}</MenuItem>
        <MenuItem noAnchor>
          <Tooltip title={actionTitle} containerDisplayMode="block">
            <ActionLink
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
              {t('The next release')}
            </ActionLink>
          </Tooltip>
          <Tooltip title={actionTitle} containerDisplayMode="block">
            <ActionLink
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
              {latestRelease
                ? t('The current release (%s)', formatVersion(latestRelease.version))
                : t('The current release')}
            </ActionLink>
          </Tooltip>
          <Tooltip title={actionTitle} containerDisplayMode="block">
            <ActionLink
              {...actionLinkProps}
              title={t('Another version')}
              onAction={() => hasRelease && this.openCustomReleaseModal()}
              shouldConfirm={false}
            >
              {t('Another version\u2026')}
            </ActionLink>
          </Tooltip>
        </MenuItem>
      </StyledDropdownLink>
    );
  }

  openCustomReleaseModal() {
    const {orgId, projectId} = this.props;

    openModal(deps => (
      <CustomResolutionModal
        {...deps}
        onSelected={(statusDetails: ResolutionStatusDetails) =>
          this.onCustomResolution(statusDetails)
        }
        orgId={orgId}
        projectId={projectId}
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

    const buttonClass = this.getButtonClass();

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
      <Wrapper hasInbox={hasInbox}>
        <Tooltip disabled={!projectFetchError} title={t('Error fetching project')}>
          {hasInbox ? (
            <div style={{width: '100%'}}>
              <li className="dropdown-submenu flex expand-left">
                {this.renderDropdownMenu()}
              </li>
            </div>
          ) : (
            <div className="btn-group">
              <StyledActionLink
                {...actionLinkProps}
                title={t('Resolve')}
                className={buttonClass}
                onAction={() => onUpdate({status: ResolutionStatus.RESOLVED})}
              >
                <StyledIconCheckmark size="xs" />
                {t('Resolve')}
              </StyledActionLink>
              {this.renderDropdownMenu()}
            </div>
          )}
        </Tooltip>
      </Wrapper>
    );
  }
}

const Wrapper = styled('div')<{hasInbox: boolean}>`
  display: inline-block;
  width: ${p => (p.hasInbox ? '100%' : 'auto')};
`;

const StyledIconCheckmark = styled(IconCheckmark)`
  margin-right: ${space(0.5)};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

const StyledActionLink = styled(ActionLink)`
  display: flex;
  align-items: center;
  transition: none;
`;

const StyledDropdownLink = styled(DropdownLink)`
  transition: none;
`;

export default ResolveActions;
