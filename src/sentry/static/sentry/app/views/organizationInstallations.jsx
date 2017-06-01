import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import IndicatorStore from '../stores/indicatorStore';
import LoadingIndicator from '../components/loadingIndicator';
import OrganizationHomeContainer from '../components/organizations/homeContainer';
import {t} from '../locale';

const OrganizationInstallations = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    return {
      loading: true,
      error: false,
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
      error: () => {
        this.setState({
          loading: false,
          error: true
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
        error: () => {
          this.setState({
            loading: false,
            error: true
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
      <div>
        <h3>{provider.name}</h3>
        {provider.installations.map(inst => {
          return (
            <div className="row" key={inst.installation_id}>
              <div className="col-md-6">
                {inst.external_organization}
              </div>
              <div className="col-md-6">
                <button
                  className="btn btn-sm btn-default"
                  onClick={this.toggleInstallation.bind(this, provider.id, inst)}>
                  {inst.linked ? 'Disable' : 'Enable'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    );
  },

  render() {
    if (this.state.loading) return <LoadingIndicator />;

    let {installationList} = this.state;
    return (
      <OrganizationHomeContainer>
        {installationList.map(this.renderProvider)}
      </OrganizationHomeContainer>
    );
  }
});

export default OrganizationInstallations;
