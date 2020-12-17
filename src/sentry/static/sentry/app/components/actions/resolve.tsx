import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';
import classNames from 'classnames';
import PropTypes from 'prop-types';

import {openModal} from 'app/actionCreators/modal';
import ActionLink from 'app/components/actions/actionLink';
import Button from 'app/components/button';
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
        <ResolvedActionWrapper>
          <Tooltip
            title={t(
              'This event is resolved due to the Auto Resolve configuration for this project'
            )}
          >
            <StyledResolveButton
              data-test-id="button-unresolve"
              icon={<IconCheckmark size="xs" />}
            />
          </Tooltip>
        </ResolvedActionWrapper>
      );
    } else {
      return (
        <ResolvedActionWrapper>
          <Tooltip title={t('Unresolve')}>
            <StyledResolveButton
              data-test-id="button-unresolve"
              icon={<IconCheckmark size="xs" />}
              onClick={() => onUpdate({status: ResolutionStatus.UNRESOLVED})}
            />
          </Tooltip>
        </ResolvedActionWrapper>
      );
    }
  }

  renderDropdownMenu() {
    const {
      projectId,
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
      <ResolveWrapper hasInbox={hasInbox}>
        <StyledDropdownLink
          key="resolve-dropdown"
          caret={!hasInbox}
          className={hasInbox ? undefined : buttonClass}
          title={hasInbox ? t('Resolve In\u2026') : ''}
          alwaysRenderMenu
          disabled={!projectId ? disabled : disableDropdown}
          anchorRight={hasInbox}
          isNestedDropdown={hasInbox}
        >
          <StyledMenuItem header>{t('Resolved In')}</StyledMenuItem>
          <StyledTooltip title={actionTitle} containerDisplayMode="block">
            <StyledActionLink
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
            </StyledActionLink>
          </StyledTooltip>
          <StyledTooltip title={actionTitle} containerDisplayMode="block">
            <StyledActionLink
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
            </StyledActionLink>
          </StyledTooltip>
          <StyledTooltip title={actionTitle} containerDisplayMode="block">
            <StyledActionLink
              {...actionLinkProps}
              title={t('Another version')}
              onAction={() => hasRelease && this.openCustomReleaseModal()}
              shouldConfirm={false}
            >
              {t('Another version\u2026')}
            </StyledActionLink>
          </StyledTooltip>
        </StyledDropdownLink>
      </ResolveWrapper>
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
      <ResolveWrapper hasInbox={hasInbox}>
        <Tooltip disabled={!projectFetchError} title={t('Error fetching project')}>
          {hasInbox ? (
            <div style={{width: '100%'}}>
              <div className="dropdown-submenu flex expand-left">
                {this.renderDropdownMenu()}
              </div>
            </div>
          ) : (
            <ResolvedActionWrapper>
              <StyledResolveActionLink
                {...actionLinkProps}
                title={t('Resolve')}
                disabled={disabled}
                onAction={() => onUpdate({status: ResolutionStatus.RESOLVED})}
              >
                <StyledIconCheckmark size="xs" />
                {t('Resolve')}
              </StyledResolveActionLink>
              {this.renderDropdownMenu()}
            </ResolvedActionWrapper>
          )}
        </Tooltip>
      </ResolveWrapper>
    );
  }
}

// currently needed when the button is disabled on the issue stream (no issues are selected)
// colors can probably be updated to use theme colors based on design
const disabledCss = css`
  color: #ced3d6;
  border-color: #e3e5e6;
  box-shadow: none;
  cursor: default;
  opacity: 0.65;
  pointer-events: none;
  background: none !important;
`;

const dropdownTipCss = p => css`
  & ul {
    padding: 0;
    border-radius: ${p.theme.borderRadius};
    top: 44px;
    &:after {
      border-bottom: 8px solid ${p.theme.bodyBackground};
    }
  }
`;

const actionLinkCss = p => css`
  color: ${p.theme.subText};
  &:hover {
    border-radius: ${p.theme.borderRadius};
    background: ${p.theme.bodyBackground};
    color: ${p.theme.textColor};
  }
`;

const ResolvedActionWrapper = styled('div')`
  display: inline-flex;
`;

const ResolveWrapper = styled('div')<{hasInbox: boolean}>`
  display: inline-flex;
  align-self: baseline;
  ${dropdownTipCss};
  & span {
    position: relative;
  }
  width: ${p => (p.hasInbox ? '100%' : 'auto')};
`;

const StyledIconCheckmark = styled(IconCheckmark)`
  margin-right: ${space(0.5)};
  align-self: center;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

const StyledResolveButton = styled(Button)`
  display: inline-flex;
  vertical-align: middle;
  color: ${p => p.theme.white};
  background: ${p => p.theme.purple300};
  border: 1px solid #4538a1;
  box-shadow: none;
  & span {
    padding: 6px 4.5px;
  }
  &:hover {
    background: ${p => p.theme.purple300};
    color: ${p => p.theme.white};
    border: 1px solid #4538a1;
  }
  ${p => (!p.onClick ? 'pointer-events: none' : null)};
`;

const StyledResolveActionLink = styled(ActionLink)`
  display: flex;
  float: left;
  color: #493e54;
  background-image: linear-gradient(to bottom, ${p => p.theme.white} 0%, #fcfbfc 100%);
  background-repeat: repeat-x;
  box-shadow: 0 2px 0 rgba(0, 0, 0, 0.03);
  font-size: ${p => p.theme.fontSizeSmall};
  padding: ${space(0.5)} 9px;
  border: 1px solid ${p => p.theme.border};
  border-radius: 3px 0 0 3px !important;
  border-right: 0;
  font-weight: 600;
  line-height: 1.5;
  user-select: none;
  transition: none;
  ${p => (p.disabled ? disabledCss : null)};
  &:hover {
    background-color: #e6e6e6;
    border-radius: 3px;
    color: ${p => p.theme.button.default.color};
    border-color: #afa3bb;
    box-shadow: 0 2px 0 rgba(0, 0, 0, 0.06);
  }
`;

const StyledMenuItem = styled(MenuItem)`
  text-transform: uppercase;
  padding: ${space(1)} 0 ${space(1)} 10px;
  font-weight: 600;
  color: ${p => p.theme.gray400};
  background: ${p => p.theme.bodyBackground};
  border-radius: ${p => p.theme.borderRadius};
`;

const StyledTooltip = styled(Tooltip)`
  :not(:first-child) {
    border-top: 1px solid ${p => p.theme.innerBorder};
  }
  > span {
    border-radius: ${p => p.theme.borderRadius};
    display: block;
  }
  &:hover > span {
    background: ${p => p.theme.bodyBackground};
    border-radius: ${p => p.theme.borderRadius};
  }
`;

const StyledActionLink = styled(ActionLink)`
  display: flex;
  align-items: center;
  transition: none;
  color: ${p => p.theme.textColor} !important;
  padding: ${space(1)} 10px ${space(1)} 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
  overflow: hidden;
  ${actionLinkCss};
`;

const StyledDropdownLink = styled(DropdownLink)`
  transition: none;
  border-top-left-radius: 0 !important;
  border-bottom-left-radius: 0 !important;
  ${p => (p.disabled ? disabledCss : null)};
`;

export default ResolveActions;
