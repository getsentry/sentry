import React from 'react';
import isEqual from 'lodash/isEqual';

import {doEventsRequest} from 'app/actionCreators/events';
import {Client} from 'app/api';
import {
  getDiffInMinutes,
  getInterval,
  isMultiSeriesStats,
} from 'app/components/charts/utils';
import {t} from 'app/locale';
import {
  EventsStats,
  GlobalSelection,
  MultiSeriesEventsStats,
  Organization,
} from 'app/types';
import {Series} from 'app/types/echarts';
import {getUtcDateString, parsePeriodToHours} from 'app/utils/dates';
import {TableData} from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {doDiscoverQuery} from 'app/utils/discover/genericDiscoverQuery';

import {Widget, WidgetQuery} from './types';

// Don't fetch more than 4000 bins as we're plotting on a small area.
const MAX_BIN_COUNT = 4000;

function getWidgetInterval(
  desired: string,
  datetimeObj: Partial<GlobalSelection['datetime']>
): string {
  const desiredPeriod = parsePeriodToHours(desired);
  const selectedRange = getDiffInMinutes(datetimeObj);

  if (selectedRange / desiredPeriod > MAX_BIN_COUNT) {
    return getInterval(datetimeObj, true);
  }
  return desired;
}

type RawResult = EventsStats | MultiSeriesEventsStats;

function transformSeries(stats: EventsStats, seriesName: string): Series {
  return {
    seriesName,
    data: stats.data.map(([timestamp, counts]) => ({
      name: timestamp * 1000,
      value: counts.reduce((acc, {count}) => acc + count, 0),
    })),
  };
}

function transformResult(query: WidgetQuery, result: RawResult): Series[] {
  let output: Series[] = [];

  const seriesNamePrefix = query.name;
  if (isMultiSeriesStats(result)) {
    // Convert multi-series results into chartable series. Multi series results
    // are created when multiple yAxis are used. Convert the timeseries
    // data into a multi-series result set.  As the server will have
    // replied with a map like: {[titleString: string]: EventsStats}
    const transformed: Series[] = Object.keys(result)
      .map((seriesName: string): [number, Series] => {
        const prefixedName = seriesNamePrefix
          ? `${seriesNamePrefix} : ${seriesName}`
          : seriesName;
        const seriesData: EventsStats = result[seriesName];
        return [seriesData.order || 0, transformSeries(seriesData, prefixedName)];
      })
      .sort((a, b) => a[0] - b[0])
      .map(item => item[1]);

    output = output.concat(transformed);
  } else {
    const field = query.fields[0];
    const prefixedName = seriesNamePrefix ? `${seriesNamePrefix} : ${field}` : field;
    const transformed = transformSeries(result, prefixedName);
    output.push(transformed);
  }

  return output;
}

type Props = {
  api: Client;
  organization: Organization;
  widget: Widget;
  selection: GlobalSelection;
  children: (
    props: Pick<State, 'loading' | 'timeseriesResults' | 'tableResults' | 'errorMessage'>
  ) => React.ReactNode;
};

type TableDataWithTitle = TableData & {title: string};

type State = {
  errorMessage: undefined | string;
  loading: boolean;
  timeseriesResults: undefined | Series[];
  tableResults: undefined | TableDataWithTitle[];
};

class WidgetQueries extends React.Component<Props, State> {
  state: State = {
    loading: true,
    errorMessage: undefined,
    timeseriesResults: undefined,
    tableResults: undefined,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const {selection, widget} = this.props;
    if (
      !isEqual(widget.displayType, prevProps.widget.displayType) ||
      !isEqual(widget.interval, prevProps.widget.interval) ||
      !isEqual(widget.queries, prevProps.widget.queries) ||
      !isEqual(widget.displayType, prevProps.widget.displayType) ||
      !isEqual(selection, prevProps.selection)
    ) {
      this.fetchData();
    }
  }

  async fetchData() {
    const {selection, api, organization, widget} = this.props;

    this.setState({loading: true, errorMessage: undefined});

    const {start, end} = selection.datetime;
    const {projects, environments} = selection;

    if (widget.displayType === 'table') {
      let tableResults: TableDataWithTitle[] = [];
      // Table and stat widgets use table results and need
      // to do a discover 'table' query instead of a 'timeseries' query.
      this.setState({tableResults: []});
      const promises = widget.queries.map(query => {
        const eventView = EventView.fromSavedQuery({
          id: undefined,
          name: query.name,
          version: 2,
          fields: query.fields,
          query: query.conditions,
          projects,
          start: start ? getUtcDateString(start) : undefined,
          end: end ? getUtcDateString(end) : undefined,
        });
        const url = `/organizations/${organization.slug}/eventsv2/`;
        return doDiscoverQuery<TableData>(api, url, {
          ...eventView.generateQueryStringObject(),
          per_page: 5,
        });
      });

      let completed = 0;
      promises.forEach(async (promise, i) => {
        try {
          const [data] = await promise;
          // Cast so we can add the title.
          const tableData = data as TableDataWithTitle;
          tableData.title = widget.queries[i]?.name ?? '';

          // Overwrite the local var to work around state being stale in tests.
          tableResults = [...tableResults, tableData];

          completed++;
          this.setState(prevState => {
            return {
              ...prevState,
              tableResults,
              loading: completed === promises.length ? false : true,
            };
          });
        } catch (err) {
          const errorMessage =
            err?.responseJSON?.detail || t('An unknown error occurred.');
          this.setState({errorMessage});
        }
      });
    } else if (widget.displayType === 'world_map') {
      this.setState({tableResults: []});
      const promises = widget.queries.map(query => {
        const eventView = EventView.fromSavedQuery({
          id: undefined,
          name: query.name,
          version: 2,
          fields: [...query.fields],
          query: query.conditions,
          projects,
          start: start ? getUtcDateString(start) : undefined,
          end: end ? getUtcDateString(end) : undefined,
        });
        const url = `/organizations/${organization.slug}/events-geo/`;
        return doDiscoverQuery<TableData>(api, url, {
          ...eventView.generateQueryStringObject(),
        });
      });

      let completed = 0;
      promises.forEach(async (promise, i) => {
        try {
          const [data] = await promise;
          // Cast so we can add the title.
          const tableData = data as TableDataWithTitle;
          tableData.title = widget.queries[i]?.name ?? '';

          completed++;
          this.setState(prevState => {
            const tableResults = [...(prevState.tableResults ?? []), tableData];
            return {
              ...prevState,
              tableResults,
              loading: completed === promises.length ? false : true,
            };
          });
        } catch (err) {
          const errorMessage =
            err?.responseJSON?.detail || t('An unknown error occurred.');
          this.setState({errorMessage});
        }
      });
    } else {
      this.setState({timeseriesResults: []});

      const statsPeriod = selection.datetime.period;
      const interval = getWidgetInterval(widget.interval, {
        start,
        end,
        period: statsPeriod,
      });
      const promises = widget.queries.map(query => {
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
      });

      let completed = 0;
      promises.forEach(async (promise, i) => {
        try {
          const rawResults = await promise;
          completed++;
          this.setState(prevState => {
            const timeseriesResults = prevState.timeseriesResults?.concat(
              transformResult(widget.queries[i], rawResults)
            );
            return {
              ...prevState,
              timeseriesResults,
              loading: completed === promises.length ? false : true,
            };
          });
        } catch (err) {
          const errorMessage =
            err?.responseJSON?.detail || t('An unknown error occurred.');
          this.setState({errorMessage});
        }
      });
    }
  }

  render() {
    const {children} = this.props;
    const {loading, timeseriesResults, tableResults, errorMessage} = this.state;

    return children({loading, timeseriesResults, tableResults, errorMessage});
  }
}

export default WidgetQueries;
