import * as React from 'react';
import isEqual from 'lodash/isEqual';

import {doEventsRequest} from 'app/actionCreators/events';
import {Client} from 'app/api';
import {
  getDiffInMinutes,
  getInterval,
  isMultiSeriesStats,
} from 'app/components/charts/utils';
import {isSelectionEqual} from 'app/components/organizations/globalSelectionHeader/utils';
import {t} from 'app/locale';
import {
  EventsStats,
  GlobalSelection,
  MultiSeriesEventsStats,
  Organization,
} from 'app/types';
import {Series} from 'app/types/echarts';
import {parsePeriodToHours} from 'app/utils/dates';
import {TableData} from 'app/utils/discover/discoverQuery';
import {
  DiscoverQueryRequestParams,
  doDiscoverQuery,
} from 'app/utils/discover/genericDiscoverQuery';

import {Widget, WidgetQuery} from './types';
import {eventViewFromWidget} from './utils';

// Don't fetch more than 4000 bins as we're plotting on a small area.
const MAX_BIN_COUNT = 4000;

function getWidgetInterval(
  widget: Widget,
  datetimeObj: Partial<GlobalSelection['datetime']>
): string {
  // Bars charts are daily totals to aligned with discover. It also makes them
  // usefully different from line/area charts until we expose the interval control, or remove it.
  let interval = widget.displayType === 'bar' ? '1d' : widget.interval;
  if (!interval) {
    // Default to 5 minutes
    interval = '5m';
  }
  const desiredPeriod = parsePeriodToHours(interval);
  const selectedRange = getDiffInMinutes(datetimeObj);

  if (selectedRange / desiredPeriod > MAX_BIN_COUNT) {
    return getInterval(datetimeObj, 'high');
  }
  return interval;
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
  queryFetchID: symbol | undefined;
  timeseriesResults: undefined | Series[];
  rawResults: undefined | RawResult[];
  tableResults: undefined | TableDataWithTitle[];
};

class WidgetQueries extends React.Component<Props, State> {
  state: State = {
    loading: true,
    queryFetchID: undefined,
    errorMessage: undefined,
    timeseriesResults: undefined,
    rawResults: undefined,
    tableResults: undefined,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const {selection, widget} = this.props;

    // We do not fetch data whenever the query name changes.
    const [prevWidgetQueryNames, prevWidgetQueries] = prevProps.widget.queries.reduce(
      ([names, queries]: [string[], Omit<WidgetQuery, 'name'>[]], {name, ...rest}) => {
        names.push(name);
        queries.push(rest);
        return [names, queries];
      },
      [[], []]
    );

    const [widgetQueryNames, widgetQueries] = widget.queries.reduce(
      ([names, queries]: [string[], Omit<WidgetQuery, 'name'>[]], {name, ...rest}) => {
        names.push(name);
        queries.push(rest);
        return [names, queries];
      },
      [[], []]
    );

    if (
      !isEqual(widget.displayType, prevProps.widget.displayType) ||
      !isEqual(widget.interval, prevProps.widget.interval) ||
      !isEqual(widgetQueries, prevWidgetQueries) ||
      !isEqual(widget.displayType, prevProps.widget.displayType) ||
      !isSelectionEqual(selection, prevProps.selection)
    ) {
      this.fetchData();
      return;
    }

    if (
      !this.state.loading &&
      !isEqual(prevWidgetQueryNames, widgetQueryNames) &&
      this.state.rawResults?.length === widget.queries.length
    ) {
      // If the query names has changed, then update timeseries labels

      // eslint-disable-next-line react/no-did-update-set-state
      this.setState(prevState => {
        const timeseriesResults = widget.queries.reduce((acc: Series[], query, index) => {
          return acc.concat(transformResult(query, prevState.rawResults![index]));
        }, []);

        return {...prevState, timeseriesResults};
      });
    }
  }

  fetchEventData(queryFetchID: symbol) {
    const {selection, api, organization, widget} = this.props;

    let tableResults: TableDataWithTitle[] = [];
    // Table, world map, and stat widgets use table results and need
    // to do a discover 'table' query instead of a 'timeseries' query.
    this.setState({tableResults: []});

    const promises = widget.queries.map(query => {
      const eventView = eventViewFromWidget(widget.title, query, selection);

      let url: string = '';
      const params: DiscoverQueryRequestParams = {
        per_page: 5,
        noPagination: true,
      };
      if (widget.displayType === 'table') {
        url = `/organizations/${organization.slug}/eventsv2/`;
        params.referrer = 'api.dashboards.tablewidget';
      } else if (widget.displayType === 'big_number') {
        url = `/organizations/${organization.slug}/eventsv2/`;
        params.per_page = 1;
        params.referrer = 'api.dashboards.bignumberwidget';
      } else if (widget.displayType === 'world_map') {
        url = `/organizations/${organization.slug}/events-geo/`;
        delete params.per_page;
        params.referrer = 'api.dashboards.worldmapwidget';
      } else {
        throw Error(
          'Expected widget displayType to be either big_number, table or world_map'
        );
      }

      return doDiscoverQuery<TableData>(api, url, {
        ...eventView.generateQueryStringObject(),
        ...params,
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

        this.setState(prevState => {
          if (prevState.queryFetchID !== queryFetchID) {
            // invariant: a different request was initiated after this request
            return prevState;
          }

          return {
            ...prevState,
            tableResults,
          };
        });
      } catch (err) {
        const errorMessage = err?.responseJSON?.detail || t('An unknown error occurred.');
        this.setState({errorMessage});
      } finally {
        completed++;
        this.setState(prevState => {
          if (prevState.queryFetchID !== queryFetchID) {
            // invariant: a different request was initiated after this request
            return prevState;
          }

          return {
            ...prevState,
            loading: completed === promises.length ? false : true,
          };
        });
      }
    });
  }

  fetchTimeseriesData(queryFetchID: symbol) {
    const {selection, api, organization, widget} = this.props;
    this.setState({timeseriesResults: [], rawResults: []});

    const {environments, projects} = selection;
    const {start, end, period: statsPeriod} = selection.datetime;
    const interval = getWidgetInterval(widget, {
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
        orderby: query.orderby,
        includePrevious: false,
        referrer: 'api.dashboards.timeserieswidget',
        partial: true,
      };
      return doEventsRequest(api, requestData);
    });

    let completed = 0;
    promises.forEach(async (promise, i) => {
      try {
        const rawResults = await promise;
        this.setState(prevState => {
          if (prevState.queryFetchID !== queryFetchID) {
            // invariant: a different request was initiated after this request
            return prevState;
          }

          const timeseriesResults = (prevState.timeseriesResults ?? []).concat(
            transformResult(widget.queries[i], rawResults)
          );

          return {
            ...prevState,
            timeseriesResults,
            rawResults: (prevState.rawResults ?? []).concat(rawResults),
          };
        });
      } catch (err) {
        const errorMessage = err?.responseJSON?.detail || t('An unknown error occurred.');
        this.setState({errorMessage});
      } finally {
        completed++;
        this.setState(prevState => {
          if (prevState.queryFetchID !== queryFetchID) {
            // invariant: a different request was initiated after this request
            return prevState;
          }

          return {
            ...prevState,
            loading: completed === promises.length ? false : true,
          };
        });
      }
    });
  }

  fetchData() {
    const {widget} = this.props;

    const queryFetchID = Symbol('queryFetchID');
    this.setState({loading: true, errorMessage: undefined, queryFetchID});

    if (['table', 'world_map', 'big_number'].includes(widget.displayType)) {
      this.fetchEventData(queryFetchID);
    } else {
      this.fetchTimeseriesData(queryFetchID);
    }
  }

  render() {
    const {children} = this.props;
    const {loading, timeseriesResults, tableResults, errorMessage} = this.state;

    return children({loading, timeseriesResults, tableResults, errorMessage});
  }
}

export default WidgetQueries;
