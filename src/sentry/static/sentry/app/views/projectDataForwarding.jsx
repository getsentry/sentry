import React from 'react';
import createReactClass from 'create-react-class';

import {t, tct} from '../locale';
import ApiMixin from '../mixins/apiMixin';
import ExternalLink from '../components/externalLink';
import HookStore from '../stores/hookStore';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {Panel, PanelBody, PanelHeader} from '../components/panels';
import PluginList from '../components/pluginList';
import ProjectState from '../mixins/projectState';
import SettingsPageHeader from './settings/components/settingsPageHeader';
import StackedBarChart from '../components/stackedBarChart';
import TextBlock from './settings/components/text/textBlock';
import EmptyStateWarning from '../components/emptyStateWarning';

const DataForwardingStats = createReactClass({
  displayName: 'DataForwardingStats',
  mixins: [ApiMixin],

  getInitialState() {
    let until = Math.floor(new Date().getTime() / 1000);
    let since = until - 3600 * 24 * 30;

    return {
      since,
      until,
      loading: true,
      error: false,
      stats: null,
      emptyStats: false,
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
        stat: 'forwarded',
      },
      success: data => {
        let emptyStats = true;
        let stats = data.map(p => {
          if (p[0]) emptyStats = false;
          return {x: p[0], y: [p[1]]};
        });
        this.setState({
          stats,
          emptyStats,
          error: false,
          loading: false,
        });
      },
      error: () => {
        this.setState({error: true, loading: false});
      },
    });
  },

  render() {
    if (this.state.loading)
      return (
        <div className="box">
          <LoadingIndicator />
        </div>
      );
    else if (this.state.error) return <LoadingError onRetry={this.fetchData} />;

    return (
      <Panel>
        <PanelHeader>{t('Forwarded events in the last 30 days (by day)')}</PanelHeader>
        <PanelBody>
          {!this.state.emptyStats ? (
            <StackedBarChart
              style={{
                border: 'none',
              }}
              points={this.state.stats}
              height={150}
              label="events"
              barClasses={['accepted']}
              className="standard-barchart"
            />
          ) : (
            <div className="blankslate p-y-2">
              <h5>{t('Nothing forwarded in the last 30 days.')}</h5>
              <p className="m-b-0">
                {t('Total events forwarded to third party integrations.')}
              </p>
            </div>
          )}
        </PanelBody>
      </Panel>
    );
  },
});

export default createReactClass({
  displayName: 'projectDataForwarding',
  mixins: [ApiMixin, ProjectState],

  getInitialState() {
    return {
      loading: true,
      error: false,
      pluginList: [],
      hooksDisabled: HookStore.get('project:data-forwarding:disabled'),
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
          pluginList: data.filter(
            p => p.type === 'data-forwarding' && p.hasConfiguration
          ),
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  onEnablePlugin(plugin) {
    this.setState({
      pluginList: this.state.pluginList.map(p => {
        if (p.id !== plugin.id) return p;
        return {
          ...plugin,
          enabled: true,
        };
      }),
    });
  },

  onDisablePlugin(plugin) {
    this.setState({
      pluginList: this.state.pluginList.map(p => {
        if (p.id !== plugin.id) return p;
        return {
          ...plugin,
          enabled: false,
        };
      }),
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
      <Panel>
        <EmptyStateWarning>
          <p>{t('There are no integrations available for data forwarding.')}</p>
        </EmptyStateWarning>
      </Panel>
    );
  },

  render() {
    let {params} = this.props;
    return (
      <div className="ref-data-forwarding-settings">
        <SettingsPageHeader title={t('Data Forwarding')} />

        <TextBlock>
          {t(
            "Enable Data Forwarding to send processed events to your favorite business intelligence tools. The exact payload and types of data depend on the integration you're using."
          )}
        </TextBlock>

        <TextBlock>
          {tct('Learn more about this functionality in our [link:documentation].', {
            link: <ExternalLink href="https://docs.sentry.io/learn/data-forwarding/" />,
          })}
        </TextBlock>

        <TextBlock>
          <small>
            {tct(
              `Note: Sentry will forward [em:all applicable events] to the
              given provider, which in some situations may be a much more significant
              volume of data.`,
              {
                em: <strong />,
              }
            )}
          </small>
        </TextBlock>

        <DataForwardingStats params={params} />

        {this.renderBody()}
      </div>
    );
  },
});
