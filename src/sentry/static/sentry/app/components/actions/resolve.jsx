import PropTypes from 'prop-types';
import React from 'react';

import {getShortVersion} from '../../utils';
import {t} from '../../locale';
import CustomResolutionModal from '../customResolutionModal';
import MenuItem from '../menuItem';
import DropdownLink from '../dropdownLink';

export default class ResolveActions extends React.Component {
  static propTypes = {
    group: PropTypes.object.isRequired,
    hasRelease: PropTypes.bool.isRequired,
    latestRelease: PropTypes.object,
    onUpdate: PropTypes.func.isRequired,
    orgId: PropTypes.string.isRequired,
    projectId: PropTypes.string.isRequired,
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

  render() {
    let {group, hasRelease, latestRelease, onUpdate} = this.props;
    let resolveClassName = 'group-resolve btn btn-default btn-sm';
    if (group.status === 'resolved') {
      resolveClassName += ' active';
    }

    if (group.status === 'resolved' && group.statusDetails.autoResolved) {
      return (
        <div className="btn-group">
          <a
            className={resolveClassName + ' tip'}
            title={t(
              'This event is resolved due to the Auto Resolve configuration for this project'
            )}
          >
            <span className="icon-checkmark" />
          </a>
        </div>
      );
    } else if (group.status === 'resolved') {
      return (
        <div className="btn-group">
          <a
            className={resolveClassName}
            title={t('Unresolve')}
            onClick={() => onUpdate({status: 'unresolved'})}
          >
            <span className="icon-checkmark" />
          </a>
        </div>
      );
    }

    let actionClassName = `tip ${!hasRelease ? 'disabled' : ''}`;
    let actionTitle = !hasRelease
      ? t('Set up release tracking in order to use this feature.')
      : '';

    return (
      <div style={{display: 'inline-block'}}>
        <CustomResolutionModal
          show={this.state.modal}
          onSelected={statusDetails => this.onCustomResolution(statusDetails)}
          onCanceled={() => this.setState({modal: false})}
          orgId={this.props.orgId}
          projectId={this.props.projectId}
        />
        <div className="btn-group">
          <a
            key="resolve-button"
            className={resolveClassName}
            title={t('Resolve')}
            onClick={() => onUpdate({status: 'resolved'})}
          >
            <span className="icon-checkmark" style={{marginRight: 5}} />
            {t('Resolve')}
          </a>
          <DropdownLink
            key="resolve-dropdown"
            caret={true}
            className={resolveClassName}
            title=""
          >
            <MenuItem header={true}>{t('Resolved In')}</MenuItem>
            <MenuItem noAnchor={true}>
              <a
                onClick={() => {
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
                className={actionClassName}
                title={actionTitle}
              >
                {t('The next release')}
              </a>
              <a
                onClick={() => {
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
                title={actionTitle}
              >
                {latestRelease
                  ? t('The current release (%s)', getShortVersion(latestRelease.version))
                  : t('The current release')}
              </a>
              <a
                onClick={() => hasRelease && this.setState({modal: true})}
                className={actionClassName}
                title={actionTitle}
              >
                {t('Another version ...')}
              </a>
            </MenuItem>
          </DropdownLink>
        </div>
      </div>
    );
  }
}
