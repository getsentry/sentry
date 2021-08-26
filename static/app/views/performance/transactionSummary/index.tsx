import {Component} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import {Location} from 'history';
import isEqual from 'lodash/isEqual';

import {loadOrganizationTags} from 'app/actionCreators/tags';
import {Client} from 'app/api';
import {t} from 'app/locale';
import {GlobalSelection, Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import DiscoverQuery from 'app/utils/discover/discoverQuery';
import EventView from 'app/utils/discover/eventView';
import {
  Column,
  isAggregateField,
  QueryFieldValue,
  WebVital,
} from 'app/utils/discover/fields';
import {removeHistogramQueryStrings} from 'app/utils/performance/histogram';
import {decodeScalar} from 'app/utils/queryString';
import {MutableSearch} from 'app/utils/tokenizeSearch';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

import {addRoutePerformanceContext, getTransactionName} from '../utils';

import {
  PERCENTILE as VITAL_PERCENTILE,
  VITAL_GROUPS,
} from './transactionVitals/constants';
import SummaryContent from './content';
import {
  decodeFilterFromLocation,
  filterToLocationQuery,
  SpanOperationBreakdownFilter,
} from './filter';
import {ZOOM_END, ZOOM_START} from './latencyChart';
import Page from './page';
import {TransactionThresholdMetric} from './transactionThresholdModal';

type Props = RouteComponentProps<{}, {}> & {
  api: Client;
  organization: Organization;
  selection: GlobalSelection;
  loadingProjects: boolean;
};

type State = {
  spanOperationBreakdownFilter: SpanOperationBreakdownFilter;
  eventView: EventView | undefined;
  transactionThreshold: number | undefined;
  transactionThresholdMetric: TransactionThresholdMetric | undefined;
};

// Used to cast the totals request to numbers
// as React.ReactText
type TotalValues = Record<string, number>;

class TransactionSummary extends Component<Props, State> {
  state: State = {
    transactionThreshold: undefined,
    transactionThresholdMetric: undefined,
    spanOperationBreakdownFilter: decodeFilterFromLocation(this.props.location),
    eventView: generateSummaryEventView(
      this.props.location,
      getTransactionName(this.props.location)
    ),
  };

  static getDerivedStateFromProps(nextProps: Readonly<Props>, prevState: State): State {
    return {
      ...prevState,
      spanOperationBreakdownFilter: decodeFilterFromLocation(nextProps.location),
      eventView: generateSummaryEventView(
        nextProps.location,
        getTransactionName(nextProps.location)
      ),
    };
  }

  componentDidMount() {
    const {api, organization, selection} = this.props;
    loadOrganizationTags(api, organization.slug, selection);
    addRoutePerformanceContext(selection);
  }

  componentDidUpdate(prevProps: Props) {
    const {api, organization, selection} = this.props;

    if (
      !isEqual(prevProps.selection.projects, selection.projects) ||
      !isEqual(prevProps.selection.datetime, selection.datetime)
    ) {
      loadOrganizationTags(api, organization.slug, selection);
      addRoutePerformanceContext(selection);
    }
  }

  onChangeFilter = (newFilter: SpanOperationBreakdownFilter) => {
    const {location, organization} = this.props;

    trackAnalyticsEvent({
      eventName: 'Performance Views: Filter Dropdown',
      eventKey: 'performance_views.filter_dropdown.selection',
      organization_id: parseInt(organization.id, 10),
      action: newFilter as string,
    });

    const nextQuery: Location['query'] = {
      ...removeHistogramQueryStrings(location, [ZOOM_START, ZOOM_END]),
      ...filterToLocationQuery(newFilter),
    };

    if (newFilter === SpanOperationBreakdownFilter.None) {
      delete nextQuery.breakdown;
    }
    browserHistory.push({
      pathname: location.pathname,
      query: nextQuery,
    });
  };

  getDocumentTitle(): string {
    const name = getTransactionName(this.props.location);

    const hasTransactionName = typeof name === 'string' && String(name).trim().length > 0;

    if (hasTransactionName) {
      return [String(name).trim(), t('Performance')].join(' - ');
    }

    return [t('Summary'), t('Performance')].join(' - ');
  }

  getTotalsEventView(organization: Organization, eventView: EventView): EventView {
    const threshold = organization.apdexThreshold.toString();

    const vitals = VITAL_GROUPS.map(({vitals: vs}) => vs).reduce(
      (keys: WebVital[], vs) => {
        vs.forEach(vital => keys.push(vital));
        return keys;
      },
      []
    );

    const totalsColumns: QueryFieldValue[] = [
      {
        kind: 'function',
        function: ['p95', '', undefined, undefined],
      },
      {
        kind: 'function',
        function: ['count', '', undefined, undefined],
      },
      {
        kind: 'function',
        function: ['count_unique', 'user', undefined, undefined],
      },
      {
        kind: 'function',
        function: ['failure_rate', '', undefined, undefined],
      },
      {
        kind: 'function',
        function: ['tpm', '', undefined, undefined],
      },
    ];

    const featureColumns: QueryFieldValue[] = organization.features.includes(
      'project-transaction-threshold'
    )
      ? [
          {
            kind: 'function',
            function: ['count_miserable', 'user', undefined, undefined],
          },
          {
            kind: 'function',
            function: ['user_misery', '', undefined, undefined],
          },
          {
            kind: 'function',
            function: ['apdex', '', undefined, undefined],
          },
        ]
      : [
          {
            kind: 'function',
            function: ['count_miserable', 'user', threshold, undefined],
          },
          {
            kind: 'function',
            function: ['user_misery', threshold, undefined, undefined],
          },
          {
            kind: 'function',
            function: ['apdex', threshold, undefined, undefined],
          },
        ];

    return eventView.withColumns([
      ...totalsColumns,
      ...featureColumns,
      ...vitals.map(
        vital =>
          ({
            kind: 'function',
            function: ['percentile', vital, VITAL_PERCENTILE.toString(), undefined],
          } as Column)
      ),
    ]);
  }

  render() {
    const {transactionThreshold, transactionThresholdMetric} = this.state;

    return (
      <Page
        title={this.getDocumentTitle()}
        location={this.props.location}
        eventView={this.state.eventView}
      >
        {contentProps => {
          const {location, organization, eventView} = contentProps;
          const totalsView = this.getTotalsEventView(organization, eventView);

          return (
            <DiscoverQuery
              eventView={totalsView}
              orgSlug={organization.slug}
              location={location}
              transactionThreshold={transactionThreshold}
              transactionThresholdMetric={transactionThresholdMetric}
              referrer="api.performance.transaction-summary"
            >
              {({isLoading, error, tableData}) => {
                const totals: TotalValues | null = tableData?.data?.[0] ?? null;
                return (
                  <SummaryContent
                    {...contentProps}
                    isLoading={isLoading}
                    error={error}
                    totalValues={totals}
                    onChangeFilter={this.onChangeFilter}
                    spanOperationBreakdownFilter={this.state.spanOperationBreakdownFilter}
                    onChangeThreshold={(threshold, metric) =>
                      this.setState({
                        transactionThreshold: threshold,
                        transactionThresholdMetric: metric,
                      })
                    }
                  />
                );
              }}
            </DiscoverQuery>
          );
        }}
      </Page>
    );
  }
}

function generateSummaryEventView(
  location: Location,
  transactionName: string | undefined
): EventView | undefined {
  if (transactionName === undefined) {
    return undefined;
  }
  // Use the user supplied query but overwrite any transaction or event type
  // conditions they applied.
  const query = decodeScalar(location.query.query, '');
  const conditions = new MutableSearch(query);
  conditions
    .setFilterValues('event.type', ['transaction'])
    .setFilterValues('transaction', [transactionName]);

  Object.keys(conditions.filters).forEach(field => {
    if (isAggregateField(field)) conditions.removeFilter(field);
  });

  const fields = ['id', 'user.display', 'transaction.duration', 'trace', 'timestamp'];

  return EventView.fromNewQueryWithLocation(
    {
      id: undefined,
      version: 2,
      name: transactionName,
      fields,
      query: conditions.formatString(),
      projects: [],
    },
    location
  );
}

export default withApi(withGlobalSelection(withOrganization(TransactionSummary)));
