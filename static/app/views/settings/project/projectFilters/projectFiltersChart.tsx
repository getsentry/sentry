import {Component} from 'react';

import type {Client} from 'sentry/api';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Series} from 'sentry/types/echarts';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import theme from 'sentry/utils/theme';
import withApi from 'sentry/utils/withApi';
import type {UsageSeries} from 'sentry/views/organizationStats/types';

type Props = {
  api: Client;
  organization: Organization;
  project: Project;
};

type State = {
  blankStats: boolean;
  error: boolean;
  formattedData: Series[];
  loading: boolean;
  statsError: boolean;
};

const STAT_OPS = {
  'browser-extensions': {title: t('Browser Extension'), color: theme.gray200},
  cors: {title: 'CORS', color: theme.yellow300},
  'error-message': {title: t('Error Message'), color: theme.purple300},
  'discarded-hash': {title: t('Discarded Issue'), color: theme.gray200},
  'invalid-csp': {title: t('Invalid CSP'), color: theme.blue300},
  'ip-address': {title: t('IP Address'), color: theme.red200},
  'legacy-browsers': {title: t('Legacy Browser'), color: theme.gray200},
  localhost: {title: t('Localhost'), color: theme.blue300},
  'release-version': {title: t('Release'), color: theme.purple200},
  'web-crawlers': {title: t('Web Crawler'), color: theme.red300},
  'filtered-transaction': {title: t('Health Check'), color: theme.yellow400},
};

class ProjectFiltersChart extends Component<Props, State> {
  state: State = {
    loading: true,
    error: false,
    statsError: false,
    formattedData: [],
    blankStats: true,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.project !== this.props.project) {
      this.fetchData();
    }
  }

  formatData(rawData: UsageSeries) {
    const formattedData = rawData.groups
      .filter(group => STAT_OPS[group.by.reason!])
      .map(group => {
        const {title, color} = STAT_OPS[group.by.reason!];
        return {
          seriesName: title,
          color,
          data: rawData.intervals
            .map((interval, index) => ({
              name: interval,
              value: group.series['sum(quantity)']![index]!,
            }))
            .filter(dataPoint => !!dataPoint.value),
        };
      });

    if (formattedData.length > 0) {
      this.setState({blankStats: false});
    }

    return formattedData;
  }

  async getFilterStats() {
    const {organization, project, api} = this.props;
    const statsEndpoint = `/organizations/${organization.slug}/stats_v2/`;
    const query = {
      project: project.id,
      category: ['transaction', 'default', 'security', 'error'],
      outcome: 'filtered',
      field: 'sum(quantity)',
      groupBy: 'reason',
      interval: '1d',
      statsPeriod: '30d',
    };

    try {
      const response = await api.requestPromise(statsEndpoint, {query});

      this.setState({
        formattedData: this.formatData(response),
        error: false,
        loading: false,
      });
    } catch {
      this.setState({error: true, loading: false});
    }
  }

  fetchData = () => {
    this.getFilterStats();
  };

  render() {
    const {loading, error, formattedData} = this.state;
    const isLoading = loading || !formattedData;
    const hasError = !isLoading && error;
    const hasLoaded = !isLoading && !error;
    const colors = formattedData
      ? formattedData.map(series => series.color || theme.gray200)
      : undefined;

    return (
      <Panel>
        <PanelHeader>{t('Events filtered in the last 30 days (by day)')}</PanelHeader>

        <PanelBody withPadding>
          {isLoading && <Placeholder height="100px" />}
          {hasError && <LoadingError onRetry={this.fetchData} />}
          {hasLoaded && !this.state.blankStats && (
            <MiniBarChart
              series={formattedData}
              colors={colors}
              height={100}
              isGroupedByDate
              stacked
              labelYAxisExtents
            />
          )}
          {hasLoaded && this.state.blankStats && (
            <EmptyMessage
              title={t('Nothing filtered in the last 30 days.')}
              description={t(
                'Issues filtered as a result of your settings below will be shown here.'
              )}
            />
          )}
        </PanelBody>
      </Panel>
    );
  }
}

export {ProjectFiltersChart};

export default withApi(ProjectFiltersChart);
