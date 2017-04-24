import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import {BooleanField} from '../components/forms';
import IndicatorStore from '../stores/indicatorStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import PluginList from '../components/pluginList';
import ProjectState from '../mixins/projectState';
import {t} from '../locale';

const Settings = React.createClass({
  propTypes: {
    initialData: React.PropTypes.object,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      formData: Object.assign({}, this.props.initialData),
      errors: {},
    };
  },

  onFieldChange(name, value) {
    let {orgId, projectId} = this.props.params;
    let prevValue = this.state.formData[name];
    let loadingIndicator = IndicatorStore.add(t('Saving changes..'));
    this.api.request(`/projects/${orgId}/${projectId}/`, {
      method: 'PUT',
      data: {[name]: value},
      success: data => {
        IndicatorStore.remove(loadingIndicator);
        this.setState({formData: {
          ...this.state.formData,
          [name]: value,
        }});
      },
      error: error => {
        IndicatorStore.remove(loadingIndicator);
        IndicatorStore.add(t('Unable to save changes. Please try again.'), 'error');
        this.setState({formData: {
          ...this.state.formData,
          [name]: prevValue,
        }});
      },
    });
  },

  render() {
    let {formData} = this.state;
    return (
      <div className="box">
        <div className="box-header">
          <h3>{t('Settings')}</h3>
        </div>

        <div className="box-content with-padding">
          <form className="form-stacked">
            <BooleanField
              key="newIssues"
              name="newIssues"
              label={t('New Issues')}
              value={formData.newIssues}
              required={false}
              onChange={this.onFieldChange.bind(this, 'newIssues')}
              help="Send an event when an issue is first seen."
            />
          </form>
        </div>
      </div>
    );
  }
});

export default React.createClass({
  mixins: [ApiMixin, ProjectState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      pluginList: []
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  fetchData() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/plugins/`, {
      success: (data, _, jqXHR) => {
        this.setState({
          error: false,
          loading: false,
          pluginList: data.filter(p => p.type === 'data-forwarding'),
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  onEnablePlugin(plugin) {
    this.setState({pluginList: this.state.pluginList.map(p => {
      if (p.id !== plugin.id)
        return p;
      return {
        ...plugin,
        enabled: true,
      };
    })});
  },

  onDisablePlugin(plugin) {
    this.setState({pluginList: this.state.pluginList.map(p => {
      if (p.id !== plugin.id)
        return p;
      return {
        ...plugin,
        enabled: false,
      };
    })});
  },

  renderBody() {
    if (this.state.loading)
      return this.renderLoading();
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let organization = this.getOrganization();
    let project = this.getProject();
    let {pluginList} = this.state;
    return (
      <PluginList
        organization={organization}
        project={project}
        pluginList={pluginList}
        onEnablePlugin={this.onEnablePlugin}
        onDisablePlugin={this.onDisablePlugin} />
    );
  },

  renderLoading() {
    return (
      <div className="box">
        <LoadingIndicator />
      </div>
    );
  },

  renderEmpty() {
    return (
      <div className="box empty-stream">
        <span className="icon icon-exclamation" />
        <p>{t('There are no integrations available for data forwarding.')}</p>
      </div>
    );
  },

  render() {
    return (
      <div>
        <h1>{t('Data Forwarding')}</h1>
        <p>Enabling Data Forwarding to send processed events to another provider based on the settings configured.</p>

        <Settings params={this.props.params} initialData={{

        }} />

        {this.renderBody()}
      </div>
    );
  }
});
