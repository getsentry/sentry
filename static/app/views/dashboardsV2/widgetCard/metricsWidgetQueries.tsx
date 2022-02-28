import * as React from 'react';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {doMetricsRequest} from 'sentry/actionCreators/metrics';
import {Client} from 'sentry/api';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {t} from 'sentry/locale';
import {MetricsApiResponse, OrganizationSummary, PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {getAggregateFields} from 'sentry/utils/discover/fields';
import {TOP_N} from 'sentry/utils/discover/types';
import {transformMetricsResponseToSeries} from 'sentry/utils/metrics/transformMetricsResponseToSeries';
import {transformMetricsResponseToTable} from 'sentry/utils/metrics/transformMetricsResponseToTable';

import {DEFAULT_TABLE_LIMIT, DisplayType, Widget} from '../types';
import {getWidgetInterval} from '../utils';

type Props = {
  api: Client;
  children: (
    props: Pick<State, 'loading' | 'timeseriesResults' | 'tableResults' | 'errorMessage'>
  ) => React.ReactNode;
  organization: OrganizationSummary;
  selection: PageFilters;
  widget: Widget;
  limit?: number;
};

type State = {
  loading: boolean;
  errorMessage?: string;
  queryFetchID?: symbol;
  rawResults?: MetricsApiResponse[];
  tableResults?: TableDataWithTitle[];
  timeseriesResults?: Series[];
};

class MetricsWidgetQueries extends React.Component<Props, State> {
  state: State = {
    loading: true,
    queryFetchID: undefined,
    errorMessage: undefined,
    timeseriesResults: undefined,
    rawResults: undefined,
    tableResults: undefined,
  };

  componentDidMount() {
    this._isMounted = true;
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const {loading, rawResults} = this.state;
    const {selection, widget, organization, limit} = this.props;
    const ignroredWidgetProps = [
      'queries',
      'title',
      'id',
      'layout',
      'tempId',
      'widgetType',
    ];
    const ignoredQueryProps = ['name', 'fields'];
    const widgetQueryNames = widget.queries.map(q => q.name);
    const prevWidgetQueryNames = prevProps.widget.queries.map(q => q.name);

    if (
      limit !== prevProps.limit ||
      organization.slug !== prevProps.organization.slug ||
      !isSelectionEqual(selection, prevProps.selection) ||
      // If the widget changed (ignore unimportant fields, + queries as they are handled lower)
      !isEqual(
        omit(widget, ignroredWidgetProps),
        omit(prevProps.widget, ignroredWidgetProps)
      ) ||
      // If the queries changed (ignore unimportant name, + fields as they are handled lower)
      !isEqual(
        widget.queries.map(q => omit(q, ignoredQueryProps)),
        prevProps.widget.queries.map(q => omit(q, ignoredQueryProps))
      ) ||
      // If the fields changed (ignore falsy/empty fields -> they can happen after clicking on Add Overlay)
      !isEqual(
        widget.queries.flatMap(q => q.fields.filter(field => !!field)),
        prevProps.widget.queries.flatMap(q => q.fields.filter(field => !!field))
      )
    ) {
      this.fetchData();
      return;
    }

    // If the query names have changed, then update timeseries labels
    if (
      !loading &&
      !isEqual(widgetQueryNames, prevWidgetQueryNames) &&
      rawResults?.length === widget.queries.length
    ) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState(prevState => {
        return {
          ...prevState,
          timeseriesResults: prevState.rawResults?.flatMap((rawResult, index) =>
            transformMetricsResponseToSeries(rawResult, widget.queries[index].name)
          ),
        };
      });
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  private _isMounted: boolean = false;

  get limit() {
    const {limit} = this.props;

    switch (this.props.widget.displayType) {
      case DisplayType.TOP_N:
        return TOP_N;
      case DisplayType.TABLE:
        return limit ?? DEFAULT_TABLE_LIMIT;
      case DisplayType.BIG_NUMBER:
        return 1;
      default:
        return undefined;
    }
  }

  fetchData() {
    const {selection, api, organization, widget} = this.props;

    if (widget.displayType === DisplayType.WORLD_MAP) {
      this.setState({errorMessage: t('World Map is not supported by metrics.')});
      return;
    }

    const queryFetchID = Symbol('queryFetchID');

    this.setState({
      loading: true,
      errorMessage: undefined,
      timeseriesResults: [],
      rawResults: [],
      tableResults: [],
      queryFetchID,
    });
    const {environments, projects, datetime} = selection;
    const {start, end, period} = datetime;
    const interval = getWidgetInterval(widget, {start, end, period});
    const widgetQuery = widget.queries[0];
    const fields = getAggregateFields(widgetQuery.fields);
    const groupingColumns = widgetQuery.fields.filter(field => !!!fields.includes(field));

    const promises = widget.queries.map(query => {
      const requestData = {
        field: fields,
        orgSlug: organization.slug,
        end,
        environment: environments,
        groupBy: groupingColumns.length ? groupingColumns : undefined, // TODO(dam): add backend groupBy support
        interval,
        limit: this.limit,
        orderBy: query.orderby || this.limit ? query.fields[0] : undefined,
        project: projects,
        query: query.conditions,
        start,
        statsPeriod: period,
      };
      return doMetricsRequest(api, requestData);
    });

    let completed = 0;
    promises.forEach(async (promise, requestIndex) => {
      try {
        const response = await promise;
        if (!this._isMounted) {
          return;
        }
        this.setState(prevState => {
          if (prevState.queryFetchID !== queryFetchID) {
            // invariant: a different request was initiated after this request
            return prevState;
          }

          // Transform to fit the table format
          if ([DisplayType.TABLE, DisplayType.BIG_NUMBER].includes(widget.displayType)) {
            const tableData = transformMetricsResponseToTable(
              response
            ) as TableDataWithTitle; // Cast so we can add the title.
            tableData.title = widget.queries[requestIndex]?.name ?? '';
            return {
              ...prevState,
              tableResults: [...(prevState.tableResults ?? []), tableData],
            };
          }

          // Transform to fit the chart format
          const timeseriesResults = [...(prevState.timeseriesResults ?? [])];
          const transformedResult = transformMetricsResponseToSeries(
            response,
            widget.queries[requestIndex].name
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
          rawResultsClone[requestIndex] = response;

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

  render() {
    const {children} = this.props;
    const {loading, timeseriesResults, tableResults, errorMessage} = this.state;

    return children({
      loading,
      timeseriesResults,
      tableResults,
      errorMessage,
    });
  }
}

export default MetricsWidgetQueries;
