import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {Client} from 'app/api';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import {t} from 'app/locale';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import LoadingError from 'app/components/loadingError';
import Placeholder from 'app/components/placeholder';
import StackedBarChart from 'app/components/stackedBarChart';

type Point = React.ComponentProps<typeof StackedBarChart>['points'][0];
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
  // TODO(ts): Add types to stats
  stats: any[] | null;
  emptyStats: boolean;
};

const getInitialState = (): State => {
  const until = Math.floor(new Date().getTime() / 1000);
  return {
    since: until - 3600 * 24 * 30,
    until,
    loading: true,
    error: false,
    stats: null,
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
        const stats = data.map(p => {
          if (p.total) {
            emptyStats = false;
          }
          return {
            x: p.ts,
            y: [p.accepted, p.dropped],
          };
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
  };

  renderTooltip = (point: Point, _pointIdx: number, chart: StackedBarChart) => {
    const timeLabel = chart.getTimeLabel(point);
    const [accepted, dropped, filtered] = point.y;

    return (
      <div style={{width: '150px'}}>
        <div className="time-label">{timeLabel}</div>
        <div className="value-label">
          {accepted.toLocaleString()} accepted
          {dropped > 0 && (
            <React.Fragment>
              <br />
              {dropped.toLocaleString()} rate limited
            </React.Fragment>
          )}
          {filtered > 0 && (
            <React.Fragment>
              <br />
              {filtered.toLocaleString()} filtered
            </React.Fragment>
          )}
        </div>
      </div>
    );
  };

  render() {
    if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    return (
      <Panel>
        <PanelHeader>{t('Key usage in the last 30 days (by day)')}</PanelHeader>
        <PanelBody>
          {this.state.loading ? (
            <Placeholder height="150px" />
          ) : !this.state.emptyStats ? (
            <StackedBarChart
              points={this.state.stats!}
              height={150}
              label="events"
              barClasses={['accepted', 'rate-limited']}
              minHeights={[1, 0]}
              className="standard-barchart"
              style={{border: 'none'}}
              tooltip={this.renderTooltip}
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
