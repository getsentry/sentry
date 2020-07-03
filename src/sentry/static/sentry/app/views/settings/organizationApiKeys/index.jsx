import {browserHistory} from 'react-router';
import React from 'react';

import {Client} from 'app/api';
import {addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import SentryTypes from 'app/sentryTypes';
import recreateRoute from 'app/utils/recreateRoute';

import OrganizationApiKeysList from './organizationApiKeysList';

class OrganizationApiKeys extends AsyncView {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  getEndpoints() {
    return [['keys', `/organizations/${this.props.params.orgId}/api-keys/`]];
  }

  getTitle() {
    const org = this.context.organization;
    return `${org.name} API Keys`;
  }

  handleRemove = id => {
    const api = new Client();
    api.request(`/organizations/${this.props.params.orgId}/api-keys/${id}/`, {
      method: 'DELETE',
      data: {},
      success: () => {
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
        addSuccessMessage(t(`Created a new API key "${data.label}"`));
      },
      error: () => {
        this.setState({busy: false});
      },
    });
  };

  renderBody() {
    return (
      <OrganizationApiKeysList
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

export default OrganizationApiKeys;
