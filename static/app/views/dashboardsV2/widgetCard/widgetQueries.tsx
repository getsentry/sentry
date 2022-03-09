import * as React from 'react';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';

import {doEventsRequest} from 'sentry/actionCreators/events';
import {Client} from 'sentry/api';
import {isMultiSeriesStats} from 'sentry/components/charts/utils';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {t} from 'sentry/locale';
import {
  EventsStats,
  MultiSeriesEventsStats,
  OrganizationSummary,
  PageFilters,
} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {TableData, TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {getAggregateFields} from 'sentry/utils/discover/fields';
import {
  DiscoverQueryRequestParams,
  doDiscoverQuery,
} from 'sentry/utils/discover/genericDiscoverQuery';
import {TOP_N} from 'sentry/utils/discover/types';

import {DEFAULT_TABLE_LIMIT, DisplayType, Widget, WidgetQuery} from '../types';
import {eventViewFromWidget, getWidgetInterval} from '../utils';

type RawResult = EventsStats | MultiSeriesEventsStats;

function transformSeries(stats: EventsStats, seriesName: string): Series {
  return {
    seriesName,
    data:
      stats?.data.map(([timestamp, counts]) => ({
        name: timestamp * 1000,
        value: counts.reduce((acc, {count}) => acc + count, 0),
      })) ?? [],
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
  children: (
    props: Pick<
      State,
      'loading' | 'timeseriesResults' | 'tableResults' | 'errorMessage' | 'pageLinks'
    >
  ) => React.ReactNode;
  organization: OrganizationSummary;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  limit?: number;
  pagination?: boolean;
};

type State = {
  loading: boolean;
  errorMessage?: string;
  pageLinks?: null | string;
  queryFetchID?: symbol;
  rawResults?: RawResult[];
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
};

class WidgetQueries extends React.Component<Props, State> {
  state: State = {
    loading: true,
    queryFetchID: undefined,
    errorMessage: undefined,
    timeseriesResults: undefined,
    rawResults: undefined,
    tableResults: undefined,
    pageLinks: undefined,
  };

  componentDidMount() {
    this._isMounted = true;
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const {selection, widget, cursor} = this.props;

    // We do not fetch data whenever the query name changes.
    // Also don't count empty fields when checking for field changes
    const [prevWidgetQueryNames, prevWidgetQueries] = prevProps.widget.queries
      .map((query: WidgetQuery) => {
        query.fields = query.fields.filter(field => !!field);
        return query;
      })
      .reduce(
        ([names, queries]: [string[], Omit<WidgetQuery, 'name'>[]], {name, ...rest}) => {
          names.push(name);
          queries.push(rest);
          return [names, queries];
        },
        [[], []]
      );

    const [widgetQueryNames, widgetQueries] = widget.queries
      .map((query: WidgetQuery) => {
        query.fields = query.fields.filter(field => !!field && field !== 'equation|');
        return query;
      })
      .reduce(
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
      !isSelectionEqual(selection, prevProps.selection) ||
      cursor !== prevProps.cursor
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

  componentWillUnmount() {
    this._isMounted = false;
  }

  private _isMounted: boolean = false;

  fetchEventData(queryFetchID: symbol) {
    const {selection, api, organization, widget, limit, cursor, pagination} = this.props;

    let tableResults: TableDataWithTitle[] = [];
    // Table, world map, and stat widgets use table results and need
    // to do a discover 'table' query instead of a 'timeseries' query.

    const promises = widget.queries.map(query => {
      const eventView = eventViewFromWidget(widget.title, query, selection);

      let url: string = '';
      const params: DiscoverQueryRequestParams = {
        per_page: limit ?? DEFAULT_TABLE_LIMIT,
        ...(!!!pagination ? {noPagination: true} : {cursor}),
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
        const [data, _textstatus, resp] = await promise;

        // Cast so we can add the title.
        const tableData = data as TableDataWithTitle;
        tableData.title = widget.queries[i]?.name ?? '';

        // Overwrite the local var to work around state being stale in tests.
        tableResults = [...tableResults, tableData];

        if (!this._isMounted) {
          return;
        }

        this.setState(prevState => {
          if (prevState.queryFetchID !== queryFetchID) {
            // invariant: a different request was initiated after this request
            return prevState;
          }

          return {
            ...prevState,
            tableResults,
            pageLinks: resp?.getResponseHeader('Link'),
          };
        });
      } catch (err) {
        const errorMessage = err?.responseJSON?.detail || t('An unknown error occurred.');
        this.setState({errorMessage});
      } finally {
        completed++;
        if (!this._isMounted) {
          return;
        }
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

  fetchTimeseriesData(queryFetchID: symbol, displayType: DisplayType) {
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
      let requestData;
      if (widget.displayType === 'top_n') {
        requestData = {
          organization,
          interval,
          start,
          end,
          project: projects,
          environment: environments,
          period: statsPeriod,
          query: query.conditions,
          yAxis: getAggregateFields(query.fields)[0],
          includePrevious: false,
          referrer: `api.dashboards.widget.${displayType}-chart`,
          partial: true,
          topEvents: TOP_N,
          field: query.fields,
        };
        if (query.orderby) {
          requestData.orderby = query.orderby;
        }
      } else {
        requestData = {
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
          referrer: `api.dashboards.widget.${displayType}-chart`,
          partial: true,
        };
      }
      return doEventsRequest(api, requestData);
    });

    let completed = 0;
    promises.forEach(async (promise, requestIndex) => {
      try {
        const rawResults = await promise;
        if (!this._isMounted) {
          return;
        }
        this.setState(prevState => {
          if (prevState.queryFetchID !== queryFetchID) {
            // invariant: a different request was initiated after this request
            return prevState;
          }

          const timeseriesResults = [...(prevState.timeseriesResults ?? [])];
          const transformedResult = transformResult(
            widget.queries[requestIndex],
            rawResults
          );
          // When charting timeseriesData on echarts, color association to a timeseries result
          // is order sensitive, ie series at index i on the timeseries array will use color at
          // index i on the color array. This means that on multi series results, we need to make
          // sure that the order of series in our results do not change between fetches to avoid
          // coloring inconsistencies between renders.
          transformedResult.forEach((result, resultIndex) => {
            timeseriesResults[requestIndex * transformedResult.length + resultIndex] =
              result;
          });

          const rawResultsClone = cloneDeep(prevState.rawResults ?? []);
          rawResultsClone[requestIndex] = rawResults;

          return {
            ...prevState,
            timeseriesResults,
            rawResults: rawResultsClone,
          };
        });
      } catch (err) {
        const errorMessage = err?.responseJSON?.detail || t('An unknown error occurred.');
        this.setState({errorMessage});
      } finally {
        completed++;
        if (!this._isMounted) {
          return;
        }
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
      this.fetchTimeseriesData(queryFetchID, widget.displayType);
    }
  }

  render() {
    const {children} = this.props;
    const {loading, timeseriesResults, tableResults, errorMessage, pageLinks} =
      this.state;

    const filteredTimeseriesResults = timeseriesResults?.filter(result => !!result);
    return children({
      loading,
      timeseriesResults: filteredTimeseriesResults,
      tableResults,
      errorMessage,
      pageLinks,
    });
  }
}

export default WidgetQueries;
