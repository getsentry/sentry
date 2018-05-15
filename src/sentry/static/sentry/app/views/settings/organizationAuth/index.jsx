import React from 'react';

import {t} from 'app/locale';
import IndicatorStore from 'app/stores/indicatorStore';
import AsyncView from 'app/views/asyncView';
import SentryTypes from 'app/proptypes';

import OrganizationAuthList from './organizationAuthList';

class OrganizationAuth extends AsyncView {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  componentWillUpdate(nextProps, nextState) {
    if (nextState.provider) {
      // If SSO provider is configured, keep showing loading while we redirect to django configuration view
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
    let org = this.context.organization;
    return `${org.name} - Auth Settings`;
  }

  handleSendReminders = provider => {
    this.setState({sendRemindersBusy: true});

    this.api.request(
      `/organizations/${this.props.params.orgId}/auth-provider/send-reminders/`,
      {
        method: 'POST',
        data: {},
        success: data => IndicatorStore.add(t('Sent reminders to members'), 'success'),
        error: err => IndicatorStore.add(t('Failed to send reminders'), 'error'),
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
      error: err => {
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
      success: data => {
        this.setState({
          provider: null,
          disableBusy: false,
        });
      },
      error: err => {
        this.setState({disableBusy: false});
      },
    });
  };

  renderBody() {
    let {providerList, provider} = this.state;

    if (!provider) {
      return (
        <OrganizationAuthList
          providerList={providerList}
          onConfigure={this.handleConfigure}
        />
      );
    }

    // If SSO provider is configured, keep showing loading while we redirect to django configuration view
    return this.renderLoading();

    /* For now this is in django
    if (provider) {
      return (
        <OrganizationAuthProvider
          orgId={orgId}
          onDisableProvider={this.handleDisableProvider}
          onSendReminders={this.handleSendReminders}
          sendRemindersBusy={sendRemindersBusy}
          disableBusy={disableBusy}
          provider={provider}
        />
      );
    }
  */
  }
}

export default OrganizationAuth;
