import React from 'react';

import ApiMixin from '../mixins/apiMixin';
import HookStore from '../stores/hookStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import PluginList from '../components/pluginList';
import ProjectState from '../mixins/projectState';
import StackedBarChart from '../components/stackedBarChart';
import {t} from '../locale';

const DataForwardingStats = React.createClass({
  mixins: [ApiMixin],

  getInitialState() {
    let until = Math.floor(new Date().getTime() / 1000);
    let since = until - 3600 * 24 * 30;

    return {
      since: since,
      until: until,
      loading: true,
      error: false,
      stats: null,
      emptyStats: false
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    let {orgId, projectId} = this.props.params;
    this.api.request(`/projects/${orgId}/${projectId}/stats/`, {
      query: {
        since: this.state.since,
        until: this.state.until,
        resolution: '1d',
        stat: 'forwarded'
      },
      success: data => {
        let emptyStats = true;
        let stats = data.map(p => {
          if (p[0]) emptyStats = false;
          return {x: p[0], y: [p[1]]};
        });
        this.setState({
          stats: stats,
          emptyStats: emptyStats,
          error: false,
          loading: false
        });
      },
      error: () => {
        this.setState({error: true, loading: false});
      }
    });
  },

  render() {
    if (this.state.loading) return <div className="box"><LoadingIndicator /></div>;
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    return (
      <div className="box">
        <div className="box-header">
          <h5>{t('Forwarded events in the last 30 days (by day)')}</h5>
        </div>
        {!this.state.emptyStats
          ? <StackedBarChart
              points={this.state.stats}
              height={150}
              label="events"
              barClasses={['accepted']}
              className="standard-barchart"
            />
          : <div className="box-content">
              <div className="blankslate p-y-2">
                <h5>{t('Nothing forwarded in the last 30 days.')}</h5>
                <p className="m-b-0">
                  {t('Total events forwarded to third party integrations.')}
                </p>
              </div>
            </div>}
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
      pluginList: [],
      hooksDisabled: HookStore.get('project:data-forwarding:disabled')
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
    let features = this.getProjectFeatures();

    if (!features.has('data-forwarding')) {
      return (
        this.state.hooksDisabled
          .map(hook => {
            return hook(organization, project);
          })
          .shift() || this.renderEmpty()
      );
    }

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
    let {params} = this.props;
    return (
      <div className="ref-data-forwarding-settings">
        <h1>{t('Data Forwarding')}</h1>
        <div className="panel panel-default">
          <div className="panel-body p-b-0">
            <p>
              {
                "Enable Data Forwarding to send processed events to your favorite business intelligence tools. The exact payload and types of data depend on the integration you're using."
              }
            </p>
            <p>
              Learn more about this functionality in our
              {' '}
              <a href="https://docs.sentry.io/learn/data-forwarding/">documentation</a>
              .
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
        <DataForwardingStats params={params} />
        {this.renderBody()}
      </div>
    );
  }
});
