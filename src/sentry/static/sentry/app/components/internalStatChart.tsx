import React from 'react';

import {Client} from 'app/api';
import MiniBarChart from 'app/components/charts/miniBarChart';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import withApi from 'app/utils/withApi';

type Props = {
  api: Client;
  since: number;
  resolution: string;
  stat: string;
  label: string;
  height?: number;
};

type State = {
  error: boolean;
  loading: boolean;
  data: [number, number][] | null;
};

class InternalStatChart extends React.Component<Props, State> {
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
    } else if (error) {
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
