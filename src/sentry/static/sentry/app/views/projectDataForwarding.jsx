import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import PluginList from '../components/pluginList';
import ProjectState from '../mixins/projectState';
import {t} from '../locale';

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
          pluginList: data.filter(p => p.type === 'data-forwarding')
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
    this.setState({
      pluginList: this.state.pluginList.map(p => {
        if (p.id !== plugin.id) return p;
        return {
          ...plugin,
          enabled: true
        };
      })
    });
  },

  onDisablePlugin(plugin) {
    this.setState({
      pluginList: this.state.pluginList.map(p => {
        if (p.id !== plugin.id) return p;
        return {
          ...plugin,
          enabled: false
        };
      })
    });
  },

  renderBody() {
    if (this.state.loading) return this.renderLoading();
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    let organization = this.getOrganization();
    let project = this.getProject();
    let {pluginList} = this.state;
    return (
      <PluginList
        organization={organization}
        project={project}
        pluginList={pluginList}
        onEnablePlugin={this.onEnablePlugin}
        onDisablePlugin={this.onDisablePlugin}
      />
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
        <div className="panel panel-default">
          <div className="panel-body p-b-0">
            <p>
              {
                "Enable Data Forwarding to send processed events to your favorite business intelligence tools. The exact payload and types of data depend on the integration you're using."
              }
            </p>
            <p>
              <small>
                Note: Sentry will forward
                {' '}
                <strong>all applicable events</strong>
                {' '}
                to the given provider, which in some situations may be a much more significant volume of data.
              </small>
            </p>
          </div>
        </div>
        {this.renderBody()}
      </div>
    );
  }
});
