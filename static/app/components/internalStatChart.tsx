import {Component} from 'react';

import type {Client} from 'sentry/api';
import MiniBarChart from 'sentry/components/charts/miniBarChart';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import withApi from 'sentry/utils/withApi';

type Props = {
  api: Client;
  label: string;
  resolution: string;
  since: number;
  stat: string;
  height?: number;
};

type State = {
  data: Array<[number, number]> | null;
  error: boolean;
  loading: boolean;
};

class InternalStatChart extends Component<Props, State> {
  state: State = {
    error: false,
    loading: true,
    data: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  shouldComponentUpdate(_nextProps: Props, nextState: State) {
    return this.state.loading !== nextState.loading;
  }

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.since !== this.props.since ||
      prevProps.stat !== this.props.stat ||
      prevProps.resolution !== this.props.resolution
    ) {
      this.fetchData();
    }
  }

  fetchData = () => {
    this.setState({loading: true});
    this.props.api.request('/internal/stats/', {
      method: 'GET',
      data: {
        since: this.props.since,
        resolution: this.props.resolution,
        key: this.props.stat,
      },
      success: data =>
        this.setState({
          data,
          loading: false,
          error: false,
        }),
      error: () => this.setState({error: true, loading: false}),
    });
  };

  render() {
    const {loading, error, data} = this.state;
    const {label, height} = this.props;
    if (loading) {
      return <LoadingIndicator />;
    }
    if (error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    const series = {
      seriesName: label,
      data:
        data?.map(([timestamp, value]) => ({
          name: timestamp * 1000,
          value,
        })) ?? [],
    };
    return (
      <MiniBarChart
        height={height ?? 150}
        series={[series]}
        isGroupedByDate
        showTimeInTooltip
        labelYAxisExtents
      />
    );
  }
}

export default withApi(InternalStatChart);
