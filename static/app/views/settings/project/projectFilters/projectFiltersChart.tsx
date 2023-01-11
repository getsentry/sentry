import {Component} from 'react';

import {Client} from 'sentry/api';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import theme from 'sentry/utils/theme';
import withApi from 'sentry/utils/withApi';

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

type RawStats = Record<string, [timestamp: number, value: number][]>;

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

  formatData(rawData: RawStats) {
    const seriesWithData: Set<string> = new Set();
    const transformed = Object.keys(STAT_OPS).map(stat => ({
      data: rawData[stat].map(([timestamp, value]) => {
        if (value > 0) {
          seriesWithData.add(STAT_OPS[stat].title);
          this.setState({blankStats: false});
        }
        return {name: timestamp * 1000, value};
      }),
      seriesName: STAT_OPS[stat].title,
      color: STAT_OPS[stat].color,
    }));

    return transformed.filter((series: Series) => seriesWithData.has(series.seriesName));
  }

  getFilterStats() {
    const statOptions = Object.keys(STAT_OPS);
    const {organization, project} = this.props;

    const until = Math.floor(new Date().getTime() / 1000);
    const since = until - 3600 * 24 * 30;

    const statEndpoint = `/projects/${organization.slug}/${project.slug}/stats/`;
    const query = {
      since,
      until,
      resolution: '1d',
    };
    const requests = statOptions.map(stat =>
      this.props.api.requestPromise(statEndpoint, {
        query: Object.assign({stat}, query),
      })
    );
    Promise.all(requests)
      .then(results => {
        const rawStatsData: RawStats = {};
        for (let i = 0; i < statOptions.length; i++) {
          rawStatsData[statOptions[i]] = results[i];
        }

        this.setState({
          formattedData: this.formatData(rawStatsData),
          error: false,
          loading: false,
        });
      })
      .catch(() => {
        this.setState({error: true, loading: false});
      });
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
        <PanelHeader>{t('Errors filtered in the last 30 days (by day)')}</PanelHeader>

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
