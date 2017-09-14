import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import LoadingIndicator from '../components/loadingIndicator';
import OrganizationHomeContainer from '../components/organizations/homeContainer';
import OrganizationState from '../mixins/organizationState';
import {t, tct} from '../locale';

const OrganizationIntegrations = React.createClass({
  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {
      loading: true,
      error: null,
      ingtegrationList: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    this.api.request(`/organizations/${this.props.params.orgId}/integrations/`, {
      method: 'GET',
      success: data => {
        this.setState({
          ingtegrationList: data,
          loading: false
        });
      },
      error: err => {
        this.setState({
          loading: false,
          error: err.responseJSON
        });
      }
    });
  },

  linkAuth(providerId, auth) {
    let indicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request(`/organizations/${this.props.params.orgId}/integrations/`, {
      method: 'POST',
      data: {
        provider: providerId,
        defaultAuthId: auth.defaultAuthId,
        integrationId: auth.integrationId
      },
      success: data => {
        // TODO(jess): we should sort this alphabetically
        let ingtegrationList = this.state.ingtegrationList.filter(provider => {
          return provider.id !== data.id;
        });
        ingtegrationList.push(data);
        this.setState({
          ingtegrationList
        });
      },
      error: err => {
        this.setState({
          loading: false,
          error: err.responseJSON
        });
      },
      complete: () => {
        IndicatorStore.remove(indicator);
      }
    });
  },

  toggleAuth(providerId, auth) {
    if (auth.linked) {
      this.disableAuth(providerId, auth);
    } else {
      this.linkAuth(providerId, auth);
    }
  },

  disableAuth(providerId, auth) {
    // TODO(jess): implement this + endpoint
  },

  renderProvider(provider) {
    let authUrl = provider.authUrl;
    if (authUrl.indexOf('?') === -1) {
      authUrl += '?next=' + encodeURIComponent(document.location.pathname);
    } else {
      authUrl += '&next=' + encodeURIComponent(document.location.pathname);
    }
    return (
      <div key={provider.id}>
        <div className="row">
          <div className="col-md-6">
            <h3>{provider.name}</h3>
          </div>
          <div className="col-md-6">
            {/* TODO(jess): we might want to only show this in certain
             situations/have diff providers be able to customize this more */}
            <a className="btn btn-default btn-sm" href={authUrl}>
              {t('Link another account')}
            </a>
          </div>
        </div>
        {provider.auths.length
          ? provider.auths.map(auth => {
              return (
                <div className="row" key={auth.externalId}>
                  <div className="col-md-6">
                    {auth.externalId}
                  </div>
                  <div className="col-md-6">
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={this.toggleAuth.bind(this, provider.id, auth)}>
                      {auth.linked ? t('Disable') : t('Enable')}
                    </button>
                  </div>
                </div>
              );
            })
          : <span>No available auth methods</span>}
      </div>
    );
  },

  renderBody() {
    let orgFeatures = new Set(this.getOrganization().features);

    if (!orgFeatures.has('integrations-v3')) {
      return (
        <div className="alert alert-warning m-b-1">
          {t("Nothing to see here. You don't have access to this feature yet.")}
        </div>
      );
    }

    if (this.state.loading) return <LoadingIndicator />;

    let error = this.state.error;
    if (error) {
      if (error.error_type === 'auth') {
        let authUrl = error.auth_url;
        if (authUrl.indexOf('?') === -1) {
          authUrl += '?next=' + encodeURIComponent(document.location.pathname);
        } else {
          authUrl += '&next=' + encodeURIComponent(document.location.pathname);
        }
        return (
          <div>
            <div className="alert alert-warning m-b-1">
              {'You need to associate an identity with ' +
                error.title +
                ' before you can create issues with this service.'}
            </div>
            <a className="btn btn-primary" href={authUrl}>
              Associate Identity
            </a>
          </div>
        );
      } else {
        return (
          <div className="alert alert-error alert-block">
            <p>
              {error.message
                ? error.message
                : tct(
                    'An unknown error occurred. Need help with this? [link:Contact support]',
                    {
                      link: <a href="https://sentry.io/support/" />
                    }
                  )}
            </p>
          </div>
        );
      }
    }

    let {ingtegrationList} = this.state;
    return (
      <div>
        {ingtegrationList.map(this.renderProvider)}
      </div>
    );
  },

  render() {
    return (
      <OrganizationHomeContainer>
        {this.renderBody()}
      </OrganizationHomeContainer>
    );
  }
});

export default OrganizationIntegrations;
