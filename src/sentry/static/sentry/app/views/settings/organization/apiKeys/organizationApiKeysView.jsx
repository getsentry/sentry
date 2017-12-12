import {browserHistory} from 'react-router';
import React from 'react';

import {Client} from '../../../../api';
import LazyLoad from '../../../../components/lazyLoad';
import OrganizationSettingsView from '../../../organizationSettingsView';
import SentryTypes from '../../../../proptypes';
import getSettingsComponent from '../../../../utils/getSettingsComponent';
import recreateRoute from '../../../../utils/recreateRoute';

class OrganizationApiKeysView extends OrganizationSettingsView {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  getEndpoints() {
    return [['keys', `/organizations/${this.props.params.orgId}/api-keys/`]];
  }

  getTitle() {
    let org = this.context.organization;
    return `${org.name} API Keys`;
  }

  handleRemove = (id, e) => {
    const api = new Client();
    api.request(`/organizations/${this.props.params.orgId}/api-keys/${id}/`, {
      method: 'DELETE',
      data: {},
      success: data => {
        this.setState(state => ({
          keys: state.keys.filter(({id: existingId}) => existingId !== id),
        }));
      },
      error: () => {
        this.setState({busy: false});
      },
    });
  };

  handleAddApiKey = () => {
    const api = new Client();
    this.setState({
      busy: true,
    });
    api.request(`/organizations/${this.props.params.orgId}/api-keys/`, {
      method: 'POST',
      data: {},
      success: data => {
        this.setState({busy: false});
        browserHistory.push(
          recreateRoute(`${data.id}/`, {
            params: this.props.params,
            routes: this.props.routes,
          })
        );
      },
      error: () => {
        this.setState({busy: false});
      },
    });
  };

  renderBody() {
    return (
      <LazyLoad
        component={() =>
          getSettingsComponent(
            () =>
              import(/*webpackChunkName: "organizationApiKeysList"*/ './organizationApiKeysList'),
            () =>
              import(/*webpackChunkName: "organizationApiKeysList.old"*/ './organizationApiKeysList.old'),
            this.props.routes
          )}
        busy={this.state.busy}
        keys={this.state.keys}
        organization={this.context.organization}
        onRemove={this.handleRemove}
        onAddApiKey={this.handleAddApiKey}
        {...this.props}
      />
    );
  }
}

export default OrganizationApiKeysView;
