import React from 'react';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import SentryTypes from 'app/sentryTypes';
import routeTitleGen from 'app/utils/routeTitle';

import OrganizationAuthList from './organizationAuthList';

class OrganizationAuth extends AsyncView {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  UNSAFE_componentWillUpdate(_nextProps, nextState) {
    const access = this.context.organization.access;

    if (nextState.provider && access.includes('org:write')) {
      // If SSO provider is configured, keep showing loading while we redirect
      // to django configuration view
      window.location.assign(`/organizations/${this.props.params.orgId}/auth/configure/`);
    }
  }

  getEndpoints() {
    return [
      ['providerList', `/organizations/${this.props.params.orgId}/auth-providers/`],
      ['provider', `/organizations/${this.props.params.orgId}/auth-provider/`],
    ];
  }

  getTitle() {
    return routeTitleGen(t('Auth Settings'), this.context.organization.slug, false);
  }

  handleSendReminders = _provider => {
    this.setState({sendRemindersBusy: true});

    this.api.request(
      `/organizations/${this.props.params.orgId}/auth-provider/send-reminders/`,
      {
        method: 'POST',
        data: {},
        success: () => addSuccessMessage(t('Sent reminders to members')),
        error: () => addErrorMessage(t('Failed to send reminders')),
        complete: () => this.setState({sendRemindersBusy: false}),
      }
    );
  };

  // Configure auth provider
  handleConfigure = provider => {
    this.setState({
      busy: true,
    });

    this.api.request(`/organizations/${this.props.params.orgId}/auth-provider/`, {
      method: 'POST',
      data: {provider, init: true},
      success: data => {
        // Redirect to auth provider URL
        if (data && data.auth_url) {
          window.location.href = data.auth_url;
        }
      },
      error: () => {
        this.setState({busy: false});
      },
    });
  };

  // Disable auth provider
  handleDisableProvider = provider => {
    this.setState({
      disableBusy: true,
    });

    this.api.request(`/organizations/${this.props.params.orgId}/auth-provider/`, {
      method: 'DELETE',
      data: {provider},
      success: () => {
        this.setState({
          provider: null,
          disableBusy: false,
        });
      },
      error: () => {
        this.setState({disableBusy: false});
      },
    });
  };

  renderBody() {
    const {providerList, provider} = this.state;
    const access = this.context.organization.access;

    if (access.includes('org:write') && provider) {
      // If SSO provider is configured, keep showing loading while we redirect
      // to django configuration view
      return this.renderLoading();
    }

    const activeProvider = providerList.find(
      p => provider && p.key === provider.provider_name
    );

    return (
      <OrganizationAuthList
        activeProvider={activeProvider}
        providerList={providerList}
        onConfigure={this.handleConfigure}
      />
    );
  }
}

export default OrganizationAuth;
