import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import LoadingIndicator from '../components/loadingIndicator';
import OrganizationHomeContainer from '../components/organizations/homeContainer';
import {t, tct} from '../locale';

const OrganizationInstallations = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: null,
      installationList: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    this.api.request(`/organizations/${this.props.params.orgId}/installations/`, {
      method: 'GET',
      success: data => {
        this.setState({
          installationList: data,
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

  toggleInstallation(providerId, installation) {
    if (!installation.linked) {
      let indicator = IndicatorStore.add(t('Saving changes..'));
      this.api.request(`/organizations/${this.props.params.orgId}/installations/`, {
        method: 'POST',
        data: {
          provider: providerId,
          installation_id: installation.installation_id
        },
        success: data => {
          // TODO(jess): we should sort this alphabetically
          let installs = this.state.installationList.filter(inst => {
            return inst.id !== data.id;
          });
          installs.push(data);
          this.setState({
            installationList: installs
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
    } else {
      // TODO(jess): handle unlinking
    }
  },

  renderProvider(provider) {
    return (
      <div key={provider.id}>
        <div className="row">
          <div className="col-md-6">
            <h3>{provider.name}</h3>
          </div>
          <div className="col-md-6">
            <a className="btn btn-primary" href={provider.install_url}>
              Install on Another Account
            </a>
          </div>
        </div>
        {provider.installations.length
          ? provider.installations.map(inst => {
              return (
                <div className="row" key={inst.installation_id}>
                  <div className="col-md-6">
                    {inst.external_organization}
                  </div>
                  <div className="col-md-6">
                    {inst.linked
                      ? 'Linked'
                      : <button
                          className="btn btn-sm btn-default"
                          onClick={this.toggleInstallation.bind(this, provider.id, inst)}>
                          Enable
                        </button>}
                  </div>
                </div>
              );
            })
          : <div className="alert alert-warning m-b-1">
              No installations available.
            </div>}
      </div>
    );
  },

  renderBody() {
    if (this.state.loading) return <LoadingIndicator />;

    let error = this.state.error;
    if (error) {
      if (error.error_type === 'auth') {
        let authUrl = error.auth_url;
        // TODO(jess): github apps are showing a redirect uri mismatch when doing
        // this :-/ but without it, we never redirect to the right place
        // if (authUrl.indexOf('?') === -1) {
        //   authUrl += '?next=' + encodeURIComponent(document.location.pathname);
        // } else {
        //   authUrl += '&next=' + encodeURIComponent(document.location.pathname);
        // }
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

    let {installationList} = this.state;
    return (
      <div>
        {installationList.map(this.renderProvider)}
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

export default OrganizationInstallations;
