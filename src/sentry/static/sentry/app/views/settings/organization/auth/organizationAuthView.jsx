import React from 'react';

import {t} from '../../../../locale';
import IndicatorStore from '../../../../stores/indicatorStore';
import OrganizationAuthList from './organizationAuthList';
import OrganizationAuthProvider from './organizationAuthProvider';
import OrganizationSettingsView from '../../../organizationSettingsView';
import SentryTypes from '../../../../proptypes';

class OrganizationAuthView extends OrganizationSettingsView {
  static contextTypes = {
    organization: SentryTypes.Organization
  };

  getEndpoints() {
    return [
      ['providerList', `/organizations/${this.props.params.orgId}/auth-providers/`],
      ['provider', `/organizations/${this.props.params.orgId}/auth-provider/`]
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
        complete: () => this.setState({sendRemindersBusy: false})
      }
    );
  };

  // Configure auth provider
  handleConfigure = provider => {
    this.setState({
      busy: true
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
      }
    });
  };

  // Disable auth provider
  handleDisableProvider = provider => {
    this.setState({
      disableBusy: true
    });

    this.api.request(`/organizations/${this.props.params.orgId}/auth-provider/`, {
      method: 'DELETE',
      data: {provider},
      success: data => {
        this.setState({
          provider: null,
          disableBusy: false
        });
      },
      error: err => {
        this.setState({disableBusy: false});
      }
    });
  };

  renderBody() {
    let {params} = this.props;
    let {orgId} = params;
    let {providerList, provider, disableBusy, sendRemindersBusy} = this.state;

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

    return (
      <OrganizationAuthList
        providerList={providerList}
        onConfigure={this.handleConfigure}
      />
    );
  }
}

export default OrganizationAuthView;
