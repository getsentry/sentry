import React from 'react';
import PropTypes from 'prop-types';
import {getShortVersion} from '../../utils';
import {t} from '../../locale';
import CustomResolutionModal from '../customResolutionModal';
import MenuItem from '../menuItem';
import DropdownLink from '../dropdownLink';
import ActionLink from './actionLink';

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
  };

  static defaultProps = {
    isResolved: false,
    isAutoResolved: false,
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

  getButtonClass() {
    return 'btn btn-default btn-sm';
  }

  renderResolved() {
    let {isAutoResolved, onUpdate} = this.props;
    let buttonClass = `${this.getButtonClass()} active`;

    if (isAutoResolved) {
      return (
        <div className="btn-group">
          <a
            className={buttonClass + ' tip'}
            title={t(
              'This event is resolved due to the Auto Resolve configuration for this project'
            )}
          >
            <span className="icon-checkmark" />
          </a>
        </div>
      );
    } else {
      return (
        <div className="btn-group">
          <a
            className={buttonClass}
            title={t('Unresolve')}
            onClick={() => onUpdate({status: 'unresolved'})}
          >
            <span className="icon-checkmark" />
          </a>
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
    } = this.props;

    let buttonClass = this.getButtonClass();

    if (disabled) {
      buttonClass += ' disabled';
    }

    if (isResolved) {
      return this.renderResolved();
    }

    let actionClassName = `tip ${!hasRelease ? 'disabled' : ''}`;
    let actionTitle = !hasRelease
      ? t('Set up release tracking in order to use this feature.')
      : '';

    let actionLinkProps = {
      shouldConfirm,
      title: actionTitle,
      message: confirmMessage,
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
            className={buttonClass}
            onAction={() => onUpdate({status: 'resolved'})}
          >
            <span className="icon-checkmark" style={{marginRight: 5}} />
            {t('Resolve')}
          </ActionLink>

          <DropdownLink
            key="resolve-dropdown"
            caret={true}
            className={buttonClass}
            title=""
            alwaysRenderMenu
          >
            <MenuItem header={true}>{t('Resolved In')}</MenuItem>
            <MenuItem noAnchor={true}>
              <ActionLink
                {...actionLinkProps}
                className={actionClassName}
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
                className={actionClassName}
              >
                {latestRelease
                  ? t('The current release (%s)', getShortVersion(latestRelease.version))
                  : t('The current release')}
              </ActionLink>

              <ActionLink
                {...actionLinkProps}
                onAction={() => hasRelease && this.setState({modal: true})}
                className={actionClassName}
                shouldConfirm={false}
              >
                {t('Another version ...')}
              </ActionLink>
            </MenuItem>
          </DropdownLink>
        </div>
      </div>
    );
  }
}
