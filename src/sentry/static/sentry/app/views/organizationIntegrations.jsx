import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import LoadingIndicator from '../components/loadingIndicator';
import OrganizationHomeContainer from '../components/organizations/homeContainer';
import {t, tct} from '../locale';

const OrganizationIntegrations = React.createClass({
  mixins: [ApiMixin],

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
        providerId: providerId,
        defaultAuthId: auth.defaultAuthId
      },
      success: data => {
        // TODO(jess): we should sort this alphabetically
        let ingtegrationList = this.state.ingtegrationList.filter(provider => {
          return provider.id !== data.id;
        });
        ingtegrationList.push(data);
        this.setState({
          ingtegrationList: ingtegrationList
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

  disableAuth(providerId, auth) {
    // TODO(jess): implement this + endpoint
  },

  renderProvider(provider) {
    return (
      <div key={provider.id}>
        <div className="row">
          <div className="col-md-12">
            <h3>{provider.name}</h3>
          </div>
        </div>
        {!!provider.availableAuth.length &&
          provider.availableAuth.map(auth => {
            return (
              <div className="row" key={auth.externalId}>
                <div className="col-md-6">
                  {auth.externalId}
                </div>
                <div className="col-md-6">
                  <button
                    className="btn btn-sm btn-default"
                    onClick={this.linkAuth.bind(this, provider.id, auth)}>
                    Enable
                  </button>
                </div>
              </div>
            );
          })}
        {!!provider.existingAuth.length &&
          provider.existingAuth.map(auth => {
            return (
              <div className="row" key={auth.externalId}>
                <div className="col-md-6">
                  {auth.externalId}
                </div>
                <div className="col-md-6">
                  <button
                    className="btn btn-sm btn-default"
                    onClick={this.disableAuth.bind(this, provider.id, auth)}>
                    Disable
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    );
  },

  renderBody() {
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
