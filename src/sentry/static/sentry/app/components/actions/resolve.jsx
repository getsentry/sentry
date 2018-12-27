import React from 'react';
import PropTypes from 'prop-types';
import classNames from 'classnames';
import {getShortVersion} from 'app/utils';
import {t} from 'app/locale';
import CustomResolutionModal from 'app/components/customResolutionModal';
import MenuItem from 'app/components/menuItem';
import DropdownLink from 'app/components/dropdownLink';
import ActionLink from 'app/components/actions/actionLink';
import Tooltip from 'app/components/tooltip';
import GuideAnchor from 'app/components/assistant/guideAnchor';

export default class ResolveActions extends React.Component {
  static propTypes = {
    hasRelease: PropTypes.bool.isRequired,
    latestRelease: PropTypes.object,
    onUpdate: PropTypes.func.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
    shouldConfirm: PropTypes.bool,
    confirmMessage: PropTypes.node,
    disabled: PropTypes.bool,
    isResolved: PropTypes.bool,
    isAutoResolved: PropTypes.bool,
    confirmLabel: PropTypes.string,
  };

  static defaultProps = {
    isResolved: false,
    isAutoResolved: false,
    confirmLabel: 'Resolve',
  };

  constructor(props) {
    super(props);
    this.state = {modal: false};
  }

  onCustomResolution(statusDetails) {
    this.setState({
      modal: false,
    });
    this.props.onUpdate({
      status: 'resolved',
      statusDetails,
    });
  }

  getButtonClass(otherClasses) {
    return classNames('btn btn-default btn-sm', otherClasses);
  }

  renderResolved() {
    let {isAutoResolved, onUpdate} = this.props;

    if (isAutoResolved) {
      return (
        <div className="btn-group">
          <Tooltip
            title={t(
              'This event is resolved due to the Auto Resolve configuration for this project'
            )}
          >
            <a className={this.getButtonClass('active')}>
              <span className="icon-checkmark" />
            </a>
          </Tooltip>
        </div>
      );
    } else {
      return (
        <div className="btn-group">
          <Tooltip title={t('Unresolve')}>
            <a
              className={this.getButtonClass('active')}
              onClick={() => onUpdate({status: 'unresolved'})}
            >
              <span className="icon-checkmark" />
            </a>
          </Tooltip>
        </div>
      );
    }
  }

  render() {
    let {
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
    } = this.props;

    let buttonClass = this.getButtonClass();

    if (isResolved) {
      return this.renderResolved();
    }

    let actionTitle = !hasRelease
      ? t('Set up release tracking in order to use this feature.')
      : '';

    let actionLinkProps = {
      shouldConfirm,
      message: confirmMessage,
      confirmLabel,
      disabled,
    };

    return (
      <div style={{display: 'inline-block'}}>
        <CustomResolutionModal
          show={this.state.modal}
          onSelected={statusDetails => this.onCustomResolution(statusDetails)}
          onCanceled={() => this.setState({modal: false})}
          orgId={orgId}
          projectId={projectId}
        />
        <div className="btn-group">
          <ActionLink
            {...actionLinkProps}
            title={'Resolve'}
            className={buttonClass}
            onAction={() => onUpdate({status: 'resolved'})}
          >
            <span className="icon-checkmark hidden-xs" style={{marginRight: 5}} />
            <GuideAnchor target="resolve" type="text" />
            {t('Resolve')}
          </ActionLink>

          <DropdownLink
            key="resolve-dropdown"
            caret={true}
            className={buttonClass}
            title=""
            alwaysRenderMenu
            disabled={disabled}
          >
            <MenuItem header={true}>{t('Resolved In')}</MenuItem>
            <MenuItem noAnchor={true}>
              <Tooltip title={actionTitle}>
                <ActionLink
                  {...actionLinkProps}
                  onAction={() => {
                    return (
                      hasRelease &&
                      onUpdate({
                        status: 'resolved',
                        statusDetails: {
                          inNextRelease: true,
                        },
                      })
                    );
                  }}
                >
                  {t('The next release')}
                </ActionLink>
              </Tooltip>
              <Tooltip title={actionTitle}>
                <ActionLink
                  {...actionLinkProps}
                  onAction={() => {
                    return (
                      hasRelease &&
                      onUpdate({
                        status: 'resolved',
                        statusDetails: {
                          inRelease: latestRelease ? latestRelease.version : 'latest',
                        },
                      })
                    );
                  }}
                >
                  {latestRelease
                    ? t(
                        'The current release (%s)',
                        getShortVersion(latestRelease.version)
                      )
                    : t('The current release')}
                </ActionLink>
              </Tooltip>
              <Tooltip title={actionTitle}>
                <ActionLink
                  {...actionLinkProps}
                  onAction={() => hasRelease && this.setState({modal: true})}
                  shouldConfirm={false}
                >
                  {t('Another version\u2026')}
                </ActionLink>
              </Tooltip>
            </MenuItem>
          </DropdownLink>
        </div>
      </div>
    );
  }
}
