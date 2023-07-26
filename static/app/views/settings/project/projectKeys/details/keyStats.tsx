import {Component} from 'react';
import {RouteComponentProps} from 'react-router';

import {Client} from 'sentry/api';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import theme from 'sentry/utils/theme';

type Props = {
  api: Client;
  organization: Organization;
} & Pick<
  RouteComponentProps<
    {
      keyId: string;
      projectId: string;
    },
    {}
  >,
  'params'
>;

type State = {
  emptyStats: boolean;
  error: boolean;
  loading: boolean;
  series: Series[];
  since: number;
  until: number;
};

const getInitialState = (): State => {
  const until = Math.floor(new Date().getTime() / 1000);
  return {
    since: until - 3600 * 24 * 30,
    until,
    loading: true,
    error: false,
    series: [],
    emptyStats: false,
  };
};

class KeyStats extends Component<Props, State> {
  state = getInitialState();

  componentDidMount() {
    this.fetchData();
  }

  fetchData = () => {
    const {organization} = this.props;
    const {keyId, projectId} = this.props.params;
    this.props.api.request(
      `/projects/${organization.slug}/${projectId}/keys/${keyId}/stats/`,
      {
        query: {
          since: this.state.since,
          until: this.state.until,
          resolution: '1d',
        },
        success: data => {
          let emptyStats = true;
          const dropped: Series['data'] = [];
          const accepted: Series['data'] = [];
          data.forEach(p => {
            if (p.total) {
              emptyStats = false;
            }
            dropped.push({name: p.ts * 1000, value: p.dropped});
            accepted.push({name: p.ts * 1000, value: p.accepted});
          });
          const series = [
            {
              seriesName: t('Accepted'),
              data: accepted,
            },
            {
              seriesName: t('Rate Limited'),
              data: dropped,
            },
          ];
          this.setState({
            series,
            emptyStats,
            error: false,
            loading: false,
          });
        },
        error: () => {
          this.setState({error: true, loading: false});
        },
      }
    );
  };

  render() {
    if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    return (
      <Panel>
        <PanelHeader>{t('Key usage in the last 30 days (by day)')}</PanelHeader>
        <PanelBody withPadding>
          {this.state.loading ? (
            <Placeholder height="150px" />
          ) : !this.state.emptyStats ? (
            <MiniBarChart
              isGroupedByDate
              series={this.state.series}
              height={150}
              colors={[theme.gray200, theme.red300]}
              stacked
              labelYAxisExtents
            />
          ) : (
            <EmptyMessage
              title={t('Nothing recorded in the last 30 days.')}
              description={t('Total events captured using these credentials.')}
            />
          )}
        </PanelBody>
      </Panel>
    );
  }
}

export default KeyStats;
