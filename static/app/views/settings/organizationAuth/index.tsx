import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {AuthProvider} from 'sentry/types/auth';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';

import OrganizationAuthList from './organizationAuthList';

type Props = DeprecatedAsyncComponent['props'] & {
  organization: Organization;
};

type State = DeprecatedAsyncComponent['state'] & {
  provider: AuthProvider | null;
  providerList: AuthProvider[] | null;
};

class OrganizationAuth extends DeprecatedAsyncComponent<Props, State> {
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

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    return [
      ['providerList', `/organizations/${organization.slug}/auth-providers/`],
      ['provider', `/organizations/${organization.slug}/auth-provider/`],
    ];
  }

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
        if (data?.auth_url) {
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
    const {organization} = this.props;
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
      <SentryDocumentTitle title={t('Auth Settings')} orgSlug={organization.slug}>
        <OrganizationAuthList
          activeProvider={activeProvider}
          providerList={providerList}
        />
      </SentryDocumentTitle>
    );
  }
}

export default withOrganization(OrganizationAuth);
