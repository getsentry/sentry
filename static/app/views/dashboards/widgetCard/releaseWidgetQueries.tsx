import {Component} from 'react';
import cloneDeep from 'lodash/cloneDeep';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';
import pick from 'lodash/pick';
import trimStart from 'lodash/trimStart';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {isSelectionEqual} from 'sentry/components/organizations/pageFilters/utils';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {Organization, SessionApiResponse} from 'sentry/types/organization';
import type {Release} from 'sentry/types/release';
import {defined} from 'sentry/utils';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import {stripDerivedMetricsPrefix} from 'sentry/utils/discover/fields';
import {TOP_N} from 'sentry/utils/discover/types';
import {dashboardFiltersToString} from 'sentry/views/dashboards/utils';

import {ReleasesConfig} from '../datasetConfig/releases';
import type {DashboardFilters, Widget, WidgetQuery} from '../types';
import {DEFAULT_TABLE_LIMIT, DisplayType} from '../types';
import {
  DERIVED_STATUS_METRICS_PATTERN,
  DerivedStatusFields,
  DISABLED_SORT,
  METRICS_EXPRESSION_TO_FIELD,
} from '../widgetBuilder/releaseWidget/fields';

import type {
  GenericWidgetQueriesChildrenProps,
  GenericWidgetQueriesProps,
} from './genericWidgetQueries';
import GenericWidgetQueries from './genericWidgetQueries';

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
  return METRICS_EXPRESSION_TO_FIELD[field] ?? field;
}

function getReleasesQuery(releases: Release[]): {
  releaseQueryString: string;
  releasesUsed: string[];
} {
  let releaseCondition = '';
  const releasesArray: string[] = [];
  releaseCondition += 'release:[' + releases[0]!.version;
  releasesArray.push(releases[0]!.version);
  for (let i = 1; i < releases.length; i++) {
    releaseCondition += ',' + releases[i]!.version;
    releasesArray.push(releases[i]!.version);
  }
  releaseCondition += ']';
  if (releases.length < 10) {
    return {releaseQueryString: releaseCondition, releasesUsed: releasesArray};
  }
  if (releases.length > 10 && releaseCondition.length > 1500) {
    return getReleasesQuery(releases.slice(0, -10));
  }
  return {releaseQueryString: releaseCondition, releasesUsed: releasesArray};
}

/**
 * Given a list of requested fields, this function returns
 * 'aggregates' which is a list of aggregate functions that
 * can be passed to either Metrics or Sessions endpoints,
 * 'derivedStatusFields' which need to be requested from the
 * Metrics endpoint and 'injectFields' which are fields not
 * requested but required to calculate the value of a derived
 * status field so will need to be stripped away in post processing.
 */
export function resolveDerivedStatusFields(
  fields: string[],
  orderby: string,
  useSessionAPI: boolean
): {
  aggregates: string[];
  derivedStatusFields: string[];
  injectedFields: string[];
} {
  const aggregates = fields.map(stripDerivedMetricsPrefix);
  const derivedStatusFields = aggregates.filter(agg =>
    Object.values(DerivedStatusFields).includes(agg as DerivedStatusFields)
  );

  const injectedFields: string[] = [];

  const rawOrderby = trimStart(orderby, '-');
  const unsupportedOrderby =
    DISABLED_SORT.includes(rawOrderby) || useSessionAPI || rawOrderby === 'release';

  if (rawOrderby && !unsupportedOrderby && !fields.includes(rawOrderby)) {
    if (!injectedFields.includes(rawOrderby)) {
      injectedFields.push(rawOrderby);
    }
  }

  if (!useSessionAPI) {
    return {aggregates, derivedStatusFields, injectedFields};
  }

  derivedStatusFields.forEach(field => {
    const result = field.match(DERIVED_STATUS_METRICS_PATTERN);
    if (result) {
      if (result[2] === 'user' && !aggregates.includes('count_unique(user)')) {
        injectedFields.push('count_unique(user)');
        aggregates.push('count_unique(user)');
      }
      if (result[2] === 'session' && !aggregates.includes('sum(session)')) {
        injectedFields.push('sum(session)');
        aggregates.push('sum(session)');
      }
    }
  });

  return {aggregates, derivedStatusFields, injectedFields};
}

export function requiresCustomReleaseSorting(query: WidgetQuery): boolean {
  const useMetricsAPI = !query.columns.includes('session.status');
  const rawOrderby = trimStart(query.orderby, '-');
  return useMetricsAPI && rawOrderby === 'release';
}

class ReleaseWidgetQueries extends Component<Props, State> {
  state: State = {
    loading: false,
    errorMessage: undefined,
    releases: undefined,
  };

  componentDidMount() {
    this._isMounted = true;
    if (requiresCustomReleaseSorting(this.props.widget.queries[0]!)) {
      this.fetchReleases();
      return;
    }
  }

  componentDidUpdate(prevProps: Readonly<Props>): void {
    if (
      !requiresCustomReleaseSorting(prevProps.widget.queries[0]!) &&
      requiresCustomReleaseSorting(this.props.widget.queries[0]!) &&
      !this.state.loading &&
      !defined(this.state.releases)
    ) {
      this.fetchReleases();
      return;
    }
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  config = ReleasesConfig;
  private _isMounted = false;

  fetchReleases = async () => {
    this.setState({loading: true, errorMessage: undefined});
    const {selection, api, organization, dashboardFilters} = this.props;
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
            // Propagate release filters
            query: dashboardFilters
              ? dashboardFiltersToString(pick(dashboardFilters, 'release'))
              : undefined,
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
    prevProps: GenericWidgetQueriesProps<SessionApiResponse, SessionApiResponse>,
    nextProps: GenericWidgetQueriesProps<SessionApiResponse, SessionApiResponse>
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
      // If the fields changed (ignore falsy/empty fields -> they can happen after clicking on Add Series)
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
    const {releases} = this.state;
    const widget = cloneDeep(initialWidget);

    const isCustomReleaseSorting = requiresCustomReleaseSorting(widget.queries[0]!);
    const isDescending = widget.queries[0]!.orderby.startsWith('-');
    const useSessionAPI = widget.queries[0]!.columns.includes('session.status');

    let releaseCondition = '';
    const releasesArray: string[] = [];
    if (isCustomReleaseSorting) {
      if (releases && releases.length === 1) {
        releaseCondition += `release:${releases[0]!.version}`;
        releasesArray.push(releases[0]!.version);
      }
      if (releases && releases.length > 1) {
        const {releaseQueryString, releasesUsed} = getReleasesQuery(releases);
        releaseCondition += releaseQueryString;
        releasesArray.push(...releasesUsed);

        if (!isDescending) {
          releasesArray.reverse();
        }
      }
    }

    if (!useSessionAPI) {
      widget.queries.forEach(query => {
        query.conditions =
          query.conditions + (releaseCondition === '' ? '' : ` ${releaseCondition}`);
      });
    }

    return widget;
  };

  afterFetchData = (data: SessionApiResponse) => {
    const {widget} = this.props;
    const {releases} = this.state;

    const isDescending = widget.queries[0]!.orderby.startsWith('-');

    const releasesArray: string[] = [];
    if (requiresCustomReleaseSorting(widget.queries[0]!)) {
      if (releases && releases.length === 1) {
        releasesArray.push(releases[0]!.version);
      }
      if (releases && releases.length > 1) {
        const {releasesUsed} = getReleasesQuery(releases);
        releasesArray.push(...releasesUsed);

        if (!isDescending) {
          releasesArray.reverse();
        }
      }
    }

    if (releasesArray.length) {
      data.groups.sort(function (group1, group2) {
        const release1 = group1.by.release;
        const release2 = group2.by.release;
        // @ts-expect-error TS(2345): Argument of type 'string | number | undefined' is ... Remove this comment to see the full error message
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
    const config = ReleasesConfig;

    return (
      <GenericWidgetQueries<SessionApiResponse, SessionApiResponse>
        config={config}
        api={api}
        organization={organization}
        selection={selection}
        widget={this.transformWidget(widget)}
        dashboardFilters={dashboardFilters}
        cursor={cursor}
        limit={this.limit}
        onDataFetched={onDataFetched}
        loading={
          requiresCustomReleaseSorting(widget.queries[0]!)
            ? !this.state.releases
            : undefined
        }
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

export default ReleaseWidgetQueries;
