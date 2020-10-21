import {RouteComponentProps} from 'react-router/lib/Router';
import * as React from 'react';

import theme from 'app/utils/theme';
import {Client} from 'app/api';
import {Series} from 'app/types/echarts';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import LoadingError from 'app/components/loadingError';
import Placeholder from 'app/components/placeholder';
import MiniBarChart from 'app/components/charts/miniBarChart';

type Props = {
  api: Client;
} & Pick<
  RouteComponentProps<
    {
      keyId: string;
      orgId: string;
      projectId: string;
    },
    {}
  >,
  'params'
>;

type State = {
  since: number;
  until: number;
  loading: boolean;
  error: boolean;
  series: Series[];
  emptyStats: boolean;
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

class KeyStats extends React.Component<Props, State> {
  state = getInitialState();

  componentDidMount() {
    this.fetchData();
  }

  fetchData = () => {
    const {keyId, orgId, projectId} = this.props.params;
    this.props.api.request(`/projects/${orgId}/${projectId}/keys/${keyId}/stats/`, {
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
    });
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
              colors={[theme.gray400, theme.red400]}
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
