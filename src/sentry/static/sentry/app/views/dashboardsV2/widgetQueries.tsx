import React from 'react';
import isEqual from 'lodash/isEqual';

import {doEventsRequest} from 'app/actionCreators/events';
import {Client} from 'app/api';
import {
  getDiffInMinutes,
  getInterval,
  isMultiSeriesStats,
} from 'app/components/charts/utils';
import {
  EventsStats,
  GlobalSelection,
  MultiSeriesEventsStats,
  Organization,
} from 'app/types';
import {Series} from 'app/types/echarts';
import {parsePeriodToHours} from 'app/utils/dates';

import {Widget} from './types';

// Don't fetch more than 2000 bin as we're plotting on fewer pixels.
const MAX_BIN_COUNT = 2000;

function getWidgetInterval(
  desired: string,
  datetimeObj: Partial<GlobalSelection['datetime']>
): string {
  const selectedRange = getDiffInMinutes(datetimeObj);
  const desiredPeriod = parsePeriodToHours(desired) * 60;
  if (selectedRange / desiredPeriod > MAX_BIN_COUNT) {
    return getInterval(datetimeObj);
  }
  return desired;
}

type RawResults = (EventsStats | MultiSeriesEventsStats)[];

function transformSeries(stats: EventsStats, seriesName: string): Series {
  return {
    seriesName,
    data: stats.data.map(([timestamp, counts]) => ({
      name: timestamp * 1000,
      value: counts.reduce((acc, {count}) => acc + count, 0),
    })),
  };
}

function transformResults(widget: Widget, results: RawResults): Series[] {
  let output: Series[] = [];
  for (let i = 0; i < results.length; i++) {
    const series = results[i];
    const seriesNamePrefix = widget.queries[i]?.name ?? '';
    if (isMultiSeriesStats(series)) {
      // Convert multi-series results into chartable series. Multi series results
      // are created when multiple yAxis are used. Convert the timeseries
      // data into a multi-series result set.  As the server will have
      // replied with a map like: {[titleString: string]: EventsStats}
      const result: Series[] = Object.keys(series)
        .map((seriesName: string): [number, Series] => {
          const prefixedName = seriesNamePrefix
            ? `${seriesNamePrefix} : ${seriesName}`
            : seriesName;
          const seriesData: EventsStats = series[seriesName];
          const transformed = transformSeries(seriesData, prefixedName);
          return [seriesData.order || 0, transformed];
        })
        .sort((a, b) => a[0] - b[0])
        .map(item => item[1]);

      output = output.concat(result);
    } else {
      const field = widget.queries[i].fields[0];
      const prefixedName = seriesNamePrefix ? `${seriesNamePrefix} : ${field}` : field;
      const transformed = transformSeries(series, prefixedName);
      output.push(transformed);
    }
  }
  return output;
}

type Props = {
  api: Client;
  organization: Organization;
  widget: Widget;
  selection: GlobalSelection;
  children: (props: Pick<State, 'loading' | 'error' | 'results'>) => React.ReactNode;
};

type State = {
  error: boolean;
  loading: boolean;
  results: Series[];
};

class WidgetQueries extends React.Component<Props, State> {
  state: State = {
    loading: true,
    error: false,
    results: [],
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const {selection, widget} = this.props;
    if (
      !isEqual(widget.queries, prevProps.widget.queries) ||
      !isEqual(selection, prevProps.selection)
    ) {
      this.fetchData();
    }
  }

  async fetchData() {
    const {selection, api, organization, widget} = this.props;

    this.setState({loading: true});

    const statsPeriod = selection.datetime.period;
    const {start, end} = selection.datetime;
    const {projects, environments} = selection;
    const interval = getWidgetInterval(widget.interval, {
      start,
      end,
      period: statsPeriod,
    });

    const promises: Promise<EventsStats | MultiSeriesEventsStats>[] = widget.queries.map(
      query => {
        // TODO(mark) adapt this based on the type of widget being built.
        // Table and stats results will need to do a different request.
        const requestData = {
          organization,
          interval,
          start,
          end,
          project: projects,
          environment: environments,
          period: statsPeriod,
          query: query.conditions,
          yAxis: query.fields,
          includePrevious: false,
        };
        return doEventsRequest(api, requestData);
      }
    );

    try {
      // Use Promise.all() to get this working. Ideally as results become available
      // they are added to the component state and incrementally exposed to children.
      const rawResults = await Promise.all(promises);
      this.setState({
        results: transformResults(widget, rawResults),
        loading: false,
        error: false,
      });
    } catch (e) {
      this.setState({loading: false, error: true});
    }
  }

  render() {
    const {children} = this.props;
    const {loading, results, error} = this.state;

    return children({loading, results, error});
  }
}

export default WidgetQueries;
