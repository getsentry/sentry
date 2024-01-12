import {Component} from 'react';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {Client} from 'sentry/api';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {MetricsApiResponse, Organization, PageFilters} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {TOP_N} from 'sentry/utils/discover/types';
import {mapToMRIFields} from 'sentry/utils/metrics';

import {MetricsConfig} from '../datasetConfig/metrics';
import {DashboardFilters, DEFAULT_TABLE_LIMIT, DisplayType, Widget} from '../types';

import GenericWidgetQueries, {
  GenericWidgetQueriesChildrenProps,
  GenericWidgetQueriesProps,
} from './genericWidgetQueries';

type Props = {
  api: Client;
  children: (props: GenericWidgetQueriesChildrenProps) => React.ReactNode;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  cursor?: string;
  dashboardFilters?: DashboardFilters;
  limit?: number;
  onDataFetched?: (results: {
    tableResults?: TableDataWithTitle[];
    timeseriesResults?: Series[];
  }) => void;
};

type State = {
  loading: boolean;
  errorMessage?: string;
};

class MetricWidgetQueries extends Component<Props, State> {
  state: State = {
    loading: true,
    errorMessage: undefined,
  };

  config = MetricsConfig;

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
        return limit ?? 20; // TODO(dam): Can be changed to undefined once [INGEST-1079] is resolved
    }
  }

  customDidUpdateComparator = (
    prevProps: GenericWidgetQueriesProps<MetricsApiResponse, MetricsApiResponse>,
    nextProps: GenericWidgetQueriesProps<MetricsApiResponse, MetricsApiResponse>
  ) => {
    const {loading, limit, widget, cursor, organization, selection, dashboardFilters} =
      nextProps;
    const ignoredWidgetProps = [
      'queries',
      'title',
      'id',
      'layout',
      'tempId',
      'widgetType',
    ];
    const ignoredQueryProps = ['name', 'fields', 'aggregates', 'columns'];
    return (
      limit !== prevProps.limit ||
      organization.slug !== prevProps.organization.slug ||
      !isEqual(dashboardFilters, prevProps.dashboardFilters) ||
      !isSelectionEqual(selection, prevProps.selection) ||
      // If the widget changed (ignore unimportant fields, + queries as they are handled lower)
      !isEqual(
        omit(widget, ignoredWidgetProps),
        omit(prevProps.widget, ignoredWidgetProps)
      ) ||
      // If the queries changed (ignore unimportant name, + fields as they are handled lower)
      !isEqual(
        widget.queries.map(q => omit(q, ignoredQueryProps)),
        prevProps.widget.queries.map(q => omit(q, ignoredQueryProps))
      ) ||
      // If the fields changed (ignore falsy/empty fields -> they can happen after clicking on Add Overlay)
      !isEqual(
        widget.queries.flatMap(q => q.fields?.filter(field => !!field)),
        prevProps.widget.queries.flatMap(q => q.fields?.filter(field => !!field))
      ) ||
      !isEqual(
        widget.queries.flatMap(q => q.aggregates.filter(aggregate => !!aggregate)),
        prevProps.widget.queries.flatMap(q =>
          q.aggregates.filter(aggregate => !!aggregate)
        )
      ) ||
      !isEqual(
        widget.queries.flatMap(q => q.columns.filter(column => !!column)),
        prevProps.widget.queries.flatMap(q => q.columns.filter(column => !!column))
      ) ||
      loading !== prevProps.loading ||
      cursor !== prevProps.cursor
    );
  };

  afterFetchData = (data: MetricsApiResponse) => {
    const fields = this.props.widget.queries[0].aggregates;
    mapToMRIFields(data, fields);
  };

  render() {
    const {
      api,
      children,
      organization,
      selection,
      widget,
      cursor,
      dashboardFilters,
      onDataFetched,
    } = this.props;
    const config = MetricsConfig;

    return (
      <GenericWidgetQueries<MetricsApiResponse, MetricsApiResponse>
        config={config}
        api={api}
        organization={organization}
        selection={selection}
        widget={widget}
        dashboardFilters={dashboardFilters}
        cursor={cursor}
        limit={this.limit}
        onDataFetched={onDataFetched}
        loading={undefined}
        customDidUpdateComparator={this.customDidUpdateComparator}
        afterFetchTableData={this.afterFetchData}
        afterFetchSeriesData={this.afterFetchData}
      >
        {({errorMessage, ...rest}) =>
          children({
            errorMessage: this.state.errorMessage ?? errorMessage,
            ...rest,
          })
        }
      </GenericWidgetQueries>
    );
  }
}

export default MetricWidgetQueries;
