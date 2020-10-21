import * as React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {IconCheckmark} from 'app/icons';
import CustomResolutionModal from 'app/components/customResolutionModal';
import MenuItem from 'app/components/menuItem';
import DropdownLink from 'app/components/dropdownLink';
import ActionLink from 'app/components/actions/actionLink';
import Tooltip from 'app/components/tooltip';
import {formatVersion} from 'app/utils/formatters';
import space from 'app/styles/space';
import {
  Release,
  ResolutionStatus,
  ResolutionStatusDetails,
  UpdateResolutionStatus,
} from 'app/types';

const defaultProps = {
  isResolved: false,
  isAutoResolved: false,
  confirmLabel: t('Resolve'),
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
} & typeof defaultProps;

type State = {
  modal: boolean;
};

class ResolveActions extends React.Component<Props, State> {
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

  state = {modal: false};

  onCustomResolution(statusDetails: ResolutionStatusDetails) {
    this.setState({
      modal: false,
    });

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

  render() {
    const {
      isResolved,
      hasRelease,
      latestRelease,
      onUpdate,
      orgId,
      projectId,
      confirmMessage,
      shouldConfirm,
      disabled,
      confirmLabel,
      disableDropdown,
      projectFetchError,
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
      <div style={{display: 'inline-block'}}>
        <CustomResolutionModal
          show={this.state.modal}
          onSelected={(statusDetails: ResolutionStatusDetails) =>
            this.onCustomResolution(statusDetails)
          }
          onCanceled={() => this.setState({modal: false})}
          orgId={orgId}
          projectId={projectId}
        />
        <Tooltip disabled={!projectFetchError} title={t('Error fetching project')}>
          <div className="btn-group">
            <ActionLink
              {...actionLinkProps}
              title={t('Resolve')}
              className={buttonClass}
              onAction={() => onUpdate({status: ResolutionStatus.RESOLVED})}
            >
              <StyledIconCheckmark size="xs" />
              {t('Resolve')}
            </ActionLink>

            <DropdownLink
              key="resolve-dropdown"
              caret
              className={buttonClass}
              title=""
              alwaysRenderMenu
              disabled={disableDropdown || disabled}
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
                      ? t(
                          'The current release (%s)',
                          formatVersion(latestRelease.version)
                        )
                      : t('The current release')}
                  </ActionLink>
                </Tooltip>
                <Tooltip title={actionTitle} containerDisplayMode="block">
                  <ActionLink
                    {...actionLinkProps}
                    title={t('Another version')}
                    onAction={() => hasRelease && this.setState({modal: true})}
                    shouldConfirm={false}
                  >
                    {t('Another version\u2026')}
                  </ActionLink>
                </Tooltip>
              </MenuItem>
            </DropdownLink>
          </div>
        </Tooltip>
      </div>
    );
  }
}

const StyledIconCheckmark = styled(IconCheckmark)`
  margin-right: ${space(0.5)};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

export default ResolveActions;
