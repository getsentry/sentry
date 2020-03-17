import React from 'react';
import pick from 'lodash/pick';
import omitBy from 'lodash/omitBy';
import isEqual from 'lodash/isEqual';
import {Location} from 'history';

import {Client} from 'app/api';
import {addErrorMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import {GlobalSelection} from 'app/types';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';

import {YAxis} from '.';

const omitIgnoredProps = (props: Props) =>
  omitBy(props, (_, key) =>
    ['api', 'version', 'orgId', 'projectSlug', 'children'].includes(key)
  );

type Series = {
  seriesName: string;
  data: {
    name: string | number;
    value: string;
  }[];
};
type ChartData = {
  [key: string]: Series;
};

type RenderProps = {
  loading: boolean;
  reloading: boolean;
  errored: boolean;
  timeseriesData: Series[] | null;
};

type Props = {
  api: Client;
  version: string;
  orgId: string;
  projectSlug: string;
  selection: GlobalSelection;
  location: Location;
  yAxis: YAxis;
  onSummaryChange: (summary: number) => void;
  children: (renderProps: RenderProps) => React.ReactNode;
};
type State = {
  reloading: boolean;
  errored: boolean;
  data: Series[] | null;
};

class ReleaseChartRequest extends React.Component<Props, State> {
  state = {
    reloading: false,
    errored: false,
    data: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    if (isEqual(omitIgnoredProps(prevProps), omitIgnoredProps(this.props))) {
      return;
    }
    this.fetchData();
  }

  componentWillUnmount() {
    this.unmounting = true;
  }

  private unmounting: boolean = false;

  fetchData = async () => {
    let data: Series[] | null;
    const {api, orgId, projectSlug, version, location, yAxis} = this.props;

    this.setState(state => ({
      reloading: state.data !== null,
      errored: false,
    }));

    try {
      const response = await api.requestPromise(
        `/projects/${orgId}/${projectSlug}/releases/${version}/stats/`,
        {
          query: {
            ...pick(location.query, [...Object.values(URL_PARAM)]),
            type: yAxis,
          },
        }
      );
      data = this.transformData(response.stats, yAxis);
    } catch (resp) {
      addErrorMessage(t('Error loading chart data'));
      data = null;
      this.setState({
        errored: true,
      });
    }

    if (this.unmounting) {
      return;
    }

    this.setState({
      reloading: false,
      data,
    });
  };

  transformData(data, yAxis: string): Series[] {
    let summary = 0;
    // here we can configure colors of the chart
    const chartData: ChartData = {
      crashed: {
        seriesName: t('Crashed'),
        data: [],
      },
      abnormal: {
        seriesName: t('Abnormal'),
        data: [],
      },
      errored: {
        seriesName: t('Errored'),
        data: [],
      },
      total: {
        seriesName: t('Total'),
        data: [],
      },
    };

    data.forEach(entry => {
      const [timeframe, values] = entry;
      const date = timeframe * 1000;
      summary += values[yAxis];
      chartData.crashed.data.push({name: date, value: values[`${yAxis}_crashed`]});
      chartData.abnormal.data.push({name: date, value: values[`${yAxis}_abnormal`]});
      chartData.errored.data.push({name: date, value: values[`${yAxis}_errored`]});
      chartData.total.data.push({name: date, value: values[yAxis]});
    });

    this.props.onSummaryChange(summary);

    return Object.values(chartData);
  }

  render() {
    const {children} = this.props;
    const {data, reloading, errored} = this.state;
    const loading = data === null;

    return children({
      loading,
      reloading,
      errored,
      timeseriesData: data,
    });
  }
}

export default ReleaseChartRequest;
