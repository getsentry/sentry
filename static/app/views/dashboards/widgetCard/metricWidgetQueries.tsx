import {Component} from 'react';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {t} from 'sentry/locale';
import {
  MetricsApiResponse,
  Organization,
  PageFilters,
  Release,
  SessionApiResponse,
} from 'sentry/types';
import {Series} from 'sentry/types/echarts';
import {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {TOP_N} from 'sentry/utils/discover/types';

import {MetricsConfig} from '../datasetConfig/metrics';
import {DashboardFilters, DEFAULT_TABLE_LIMIT, DisplayType, Widget} from '../types';

import GenericWidgetQueries, {
  GenericWidgetQueriesChildrenProps,
  GenericWidgetQueriesProps,
} from './genericWidgetQueries';

type Props = {
  api: Client;
  children: (props: GenericWidgetQueriesChildrenProps) => JSX.Element;
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
  releases?: Release[];
};

export function derivedMetricsToField(field: string): string {
  return field;
}

export function resolveDerivedStatusFields(fields: string[]): {
  aggregates: string[];
  derivedStatusFields: string[];
  injectedFields: string[];
} {
  return {aggregates: fields, derivedStatusFields: [], injectedFields: []};
}

class MetricWidgetQueries extends Component<Props, State> {
  state: State = {
    loading: true,
    errorMessage: undefined,
    releases: undefined,
  };

  componentDidMount() {
    this._isMounted = true;
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  config = MetricsConfig;
  private _isMounted: boolean = false;

  fetchReleases = async () => {
    this.setState({loading: true, errorMessage: undefined});
    const {selection, api, organization} = this.props;
    const {environments, projects} = selection;

    try {
      const releases = await api.requestPromise(
        `/organizations/${organization.slug}/releases/`,
        {
          method: 'GET',
          data: {
            sort: 'date',
            project: projects,
            per_page: 50,
            environment: environments,
          },
        }
      );
      if (!this._isMounted) {
        return;
      }
      this.setState({releases, loading: false});
    } catch (error) {
      if (!this._isMounted) {
        return;
      }

      const message = error.responseJSON
        ? error.responseJSON.error
        : t('Error sorting by releases');
      this.setState({errorMessage: message, loading: false});
      addErrorMessage(message);
    }
  };

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

  transformWidget = (initialWidget: Widget): Widget => {
    const widget = cloneDeep(initialWidget);

    const releaseCondition = '';

    widget.queries.forEach(query => {
      query.conditions =
        query.conditions + (releaseCondition === '' ? '' : ` ${releaseCondition}`);
    });

    return widget;
  };

  afterFetchData = (data: SessionApiResponse | MetricsApiResponse) => {
    const releasesArray: string[] = [];

    if (releasesArray.length) {
      data.groups.sort(function (group1, group2) {
        const release1 = group1.by.release;
        const release2 = group2.by.release;
        return releasesArray.indexOf(release1) - releasesArray.indexOf(release2);
      });
      data.groups = data.groups.slice(0, this.limit);
    }
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
        widget={this.transformWidget(widget)}
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
