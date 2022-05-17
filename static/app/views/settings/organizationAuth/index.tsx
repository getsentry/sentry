import {RouteComponentProps} from 'react-router';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {AuthProvider, Organization} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import OrganizationAuthList from './organizationAuthList';

type Props = AsyncView['props'] &
  RouteComponentProps<{orgId: string}, {}> & {
    organization: Organization;
  };

type State = AsyncView['state'] & {
  provider: AuthProvider | null;
  providerList: AuthProvider[] | null;
};

class OrganizationAuth extends AsyncView<Props, State> {
  UNSAFE_componentWillUpdate(_nextProps: Props, nextState: State) {
    const access = this.props.organization.access;

    if (nextState.provider && access.includes('org:write')) {
      // If SSO provider is configured, keep showing loading while we redirect
      // to django configuration view
      const path = `/organizations/${this.props.params.orgId}/auth/configure/`;

      // Don't break the back button by first replacing the current history
      // state so pressing back skips this react view.
      this.props.router.replace(path);
      window.location.assign(path);
    }
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [
      ['providerList', `/organizations/${this.props.params.orgId}/auth-providers/`],
      ['provider', `/organizations/${this.props.params.orgId}/auth-provider/`],
    ];
  }

  getTitle() {
    return routeTitleGen(t('Auth Settings'), this.props.organization.slug, false);
  }

  /**
   * TODO(epurkhiser): This does not work right now as we still fallback to the
   * old SSO auth configuration page
   */
  handleSendReminders = (_provider: AuthProvider) => {
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

  /**
   * TODO(epurkhiser): This does not work right now as we still fallback to the
   * old SSO auth configuration page
   */
  handleConfigure = (provider: AuthProvider) => {
    this.setState({busy: true});

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

  /**
   * TODO(epurkhiser): This does not work right now as we still fallback to the
   * old SSO auth configuration page
   */
  handleDisableProvider = (provider: AuthProvider) => {
    this.setState({busy: true});

    this.api.request(`/organizations/${this.props.params.orgId}/auth-provider/`, {
      method: 'DELETE',
      data: {provider},
      success: () => {
        this.setState({provider: null, busy: false});
      },
      error: () => {
        this.setState({busy: false});
      },
    });
  };

  renderBody() {
    const {providerList, provider} = this.state;

    if (providerList === null) {
      return null;
    }

    if (this.props.organization.access.includes('org:write') && provider) {
      // If SSO provider is configured, keep showing loading while we redirect
      // to django configuration view
      return this.renderLoading();
    }

    const activeProvider = providerList?.find(p => p.key === provider?.key);

    return (
      <OrganizationAuthList activeProvider={activeProvider} providerList={providerList} />
    );
  }
}

export default withOrganization(OrganizationAuth);
