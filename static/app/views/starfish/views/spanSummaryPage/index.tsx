import {RouteComponentProps} from 'react-router';
import {Location} from 'history';
import * as qs from 'query-string';

import Breadcrumbs, {Crumb} from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {fromSorts} from 'sentry/utils/discover/eventView';
import {Sort} from 'sentry/utils/discover/fields';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {StarfishPageFiltersContainer} from 'sentry/views/starfish/components/starfishPageFiltersContainer';
import {
  SpanSummaryQueryFilters,
  useSpanMetrics,
} from 'sentry/views/starfish/queries/useSpanMetrics';
import {extractRoute} from 'sentry/views/starfish/utils/extractRoute';
import {ROUTE_NAMES} from 'sentry/views/starfish/utils/routeNames';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {getSpanOperationDescription} from 'sentry/views/starfish/views/spanSummaryPage/getSpanOperationDescription';
import {SampleList} from 'sentry/views/starfish/views/spanSummaryPage/sampleList';
import {SpanSummaryView} from 'sentry/views/starfish/views/spanSummaryPage/spanSummaryView';
import {
  isAValidSort,
  SpanTransactionsTable,
} from 'sentry/views/starfish/views/spanSummaryPage/spanTransactionsTable';

type Query = {
  endpoint: string;
  endpointMethod: string;
  transaction: string;
  transactionMethod: string;
  [QueryParameterNames.SPANS_SORT]: string;
};

type Props = {
  location: Location<Query>;
} & RouteComponentProps<Query, {groupId: string}>;

function SpanSummaryPage({params, location}: Props) {
  const organization = useOrganization();
  const {groupId} = params;

  const {transaction, transactionMethod, endpoint, endpointMethod} = location.query;

  const queryFilter: SpanSummaryQueryFilters = endpoint
    ? {transactionName: endpoint, 'transaction.method': endpointMethod}
    : {};

  const sort =
    fromSorts(location.query[QueryParameterNames.ENDPOINTS_SORT]).filter(
      isAValidSort
    )[0] ?? DEFAULT_SORT; // We only allow one sort on this table in this view

  if (endpointMethod && queryFilter) {
    queryFilter['transaction.method'] = endpointMethod;
  }

  const {data: spanMetrics, isLoading: isSpanMetricsLoading} = useSpanMetrics(
    groupId,
    queryFilter,
    ['span.op', 'span.group', 'project.id', 'sps()'],
    'api.starfish.span-summary-page-metrics'
  );

  const span = {
    ['span.op']: spanMetrics['span.op'],
    ['span.group']: groupId,
  };

  const title = [getSpanOperationDescription(span['span.op']), t('Summary')].join(' ');

  const crumbs: Crumb[] = [];
  crumbs.push({
    label: t('Web Service'),
    to: normalizeUrl(`/organizations/${organization.slug}/starfish/`),
  });
  const extractedRoute = extractRoute(location);
  if (extractedRoute && ROUTE_NAMES[extractedRoute]) {
    crumbs.push({
      label: ROUTE_NAMES[extractedRoute],
      to: normalizeUrl(
        `/organizations/${organization.slug}/starfish/${
          extractedRoute ?? 'spans'
        }/?${qs.stringify({
          endpoint,
          'http.method': endpointMethod,
        })}`
      ),
    });
  }
  crumbs.push({
    label: title,
  });

  return (
    <SentryDocumentTitle title={title} orgSlug={organization.slug}>
      <Layout.Page>
        <StarfishPageFiltersContainer>
          <PageErrorProvider>
            <Layout.Header>
              <Layout.HeaderContent>
                {!isSpanMetricsLoading && <Breadcrumbs crumbs={crumbs} />}
                <Layout.Title>
                  {endpointMethod && endpoint
                    ? `${endpointMethod} ${endpoint}`
                    : !isSpanMetricsLoading && title}
                </Layout.Title>
              </Layout.HeaderContent>
            </Layout.Header>
            <Layout.Body>
              <Layout.Main fullWidth>
                <PageErrorAlert />

                <SpanSummaryView groupId={groupId} />

                {span && (
                  <SpanTransactionsTable
                    span={span}
                    sort={sort}
                    endpoint={endpoint}
                    endpointMethod={endpointMethod}
                  />
                )}

                <SampleList
                  groupId={span['span.group']}
                  transactionName={transaction}
                  transactionMethod={transactionMethod}
                />
              </Layout.Main>
            </Layout.Body>
          </PageErrorProvider>
        </StarfishPageFiltersContainer>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

export default SpanSummaryPage;

const DEFAULT_SORT: Sort = {
  kind: 'desc',
  field: 'time_spent_percentage()',
};
