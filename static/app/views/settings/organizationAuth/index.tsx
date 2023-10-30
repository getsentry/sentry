import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import {AuthProvider, Organization} from 'sentry/types';
import routeTitleGen from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView from 'sentry/views/deprecatedAsyncView';

import OrganizationAuthList from './organizationAuthList';

type Props = DeprecatedAsyncView['props'] & {
  organization: Organization;
};

type State = DeprecatedAsyncView['state'] & {
  provider: AuthProvider | null;
  providerList: AuthProvider[] | null;
};

class OrganizationAuth extends DeprecatedAsyncView<Props, State> {
  componentDidUpdate() {
    const {organization} = this.props;
    const access = organization.access;

    if (this.state.provider && access.includes('org:write')) {
      // If SSO provider is configured, keep showing loading while we redirect
      // to django configuration view
      // XXX: This does not need to be normalized for customer-domains because we're going
      // to a django rendered view.
      const path = `/organizations/${organization.slug}/auth/configure/`;

      // Use replace so we don't go back to the /settings/auth and hit this path again.
      window.location.replace(path);
    }
  }

  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    const {organization} = this.props;
    return [
      ['providerList', `/organizations/${organization.slug}/auth-providers/`],
      ['provider', `/organizations/${organization.slug}/auth-provider/`],
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
    const {organization} = this.props;
    this.setState({sendRemindersBusy: true});

    this.api.request(
      `/organizations/${organization.slug}/auth-provider/send-reminders/`,
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
    const {organization} = this.props;
    this.setState({busy: true});

    this.api.request(`/organizations/${organization.slug}/auth-provider/`, {
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
    const {organization} = this.props;
    this.setState({busy: true});

    this.api.request(`/organizations/${organization.slug}/auth-provider/`, {
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
