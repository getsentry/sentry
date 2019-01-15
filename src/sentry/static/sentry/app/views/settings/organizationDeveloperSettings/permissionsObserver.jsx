import PropTypes from 'prop-types';
import React from 'react';

import ConsolidatedScopes from 'app/utils/consolidatedScopes';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import PermissionSelection from 'app/views/settings/organizationDeveloperSettings/permissionSelection';
import Subscriptions from 'app/views/settings/organizationDeveloperSettings/resourceSubscriptions';

export default class PermissionsObserver extends React.Component {
  static contextTypes = {
    router: PropTypes.object.isRequired,
    form: PropTypes.object,
  };

  static propTypes = {
    scopes: PropTypes.arrayOf(PropTypes.string).isRequired,
    events: PropTypes.arrayOf(PropTypes.string).isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      permissions: this.scopeListToPermissionState(),
      events: this.props.events,
    };
  }
  /**
   * Converts the list of raw API scopes passed in to an object that can
   * before stored and used via `state`. This object is structured by
   * resource and holds "Permission" values. For example:
   *
   *    {
   *      'Project': 'read',
   *      ...,
   *    }
   *
   */
  scopeListToPermissionState() {
    return new ConsolidatedScopes(this.props.scopes).toResourcePermissions();
  }

  onPermissionChange = permissions => {
    this.setState({permissions});
  };

  onEventChange = events => {
    this.setState({events});
  };

  render() {
    const {permissions, events} = this.state;
    return (
      <React.Fragment>
        <Panel>
          <PanelHeader>{t('Permissions')}</PanelHeader>
          <PanelBody>
            <PermissionSelection
              permissions={permissions}
              onChange={this.onPermissionChange}
            />
          </PanelBody>
        </Panel>
        <Panel>
          <PanelHeader>{t('Resource Subscriptions')}</PanelHeader>
          <PanelBody>
            <Subscriptions
              permissions={permissions}
              events={events}
              onChange={this.onEventChange}
            />
          </PanelBody>
        </Panel>
      </React.Fragment>
    );
  }
}
