import {Fragment} from 'react';
import styled from '@emotion/styled';
import keyBy from 'lodash/keyBy';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {Button} from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {Referrer} from 'sentry/views/performance/cache/referrers';
import {TransactionDurationChart} from 'sentry/views/performance/cache/samplePanel/charts/transactionDurationChart';
import {BASE_FILTERS} from 'sentry/views/performance/cache/settings';
import {SpanSamplesTable} from 'sentry/views/performance/cache/tables/spanSamplesTable';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import {getTimeSpentExplanation} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useIndexedSpans} from 'sentry/views/starfish/queries/useIndexedSpans';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useTransactions} from 'sentry/views/starfish/queries/useTransactions';
import {
  SpanFunction,
  SpanIndexedField,
  type SpanIndexedQueryFilters,
  SpanMetricsField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/starfish/types';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';

// This is similar to http sample table, its difficult to use the generic span samples sidebar as we require a bunch of custom things.
export function CacheSamplePanel() {
  const router = useRouter();
  const organization = useOrganization();

  const query = useLocationQuery({
    fields: {
      project: decodeScalar,
      transaction: decodeScalar,
    },
  });

  // `detailKey` controls whether the panel is open. If all required properties are ailable, concat them to make a key, otherwise set to `undefined` and hide the panel
  const detailKey = query.transaction
    ? [query.transaction].filter(Boolean).join(':')
    : undefined;

  const isPanelOpen = Boolean(detailKey);

  const filters: SpanMetricsQueryFilters = {
    ...BASE_FILTERS,
    transaction: query.transaction,
    'project.id': query.project,
  };

  const {data: cacheTransactionMetrics, isFetching: areCacheTransactionMetricsFetching} =
    useSpanMetrics({
      search: MutableSearch.fromQueryObject(filters),
      fields: [
        `${SpanFunction.SPM}()`,
        `${SpanFunction.CACHE_MISS_RATE}()`,
        `${SpanFunction.TIME_SPENT_PERCENTAGE}()`,
        `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
      ],
      enabled: isPanelOpen,
      referrer: Referrer.SAMPLES_CACHE_METRICS_RIBBON,
    });

  const sampleFilters: SpanIndexedQueryFilters = {
    ...BASE_FILTERS,
    transaction: query.transaction,
    project_id: query.project,
  };

  const {
    data: cacheSpanSamplesData,
    isFetching: isCacheSpanSamplesFetching,
    refetch: refetchSpanSamples,
  } = useIndexedSpans({
    search: MutableSearch.fromQueryObject(sampleFilters).addFreeText('has:cache.hit'),
    fields: [
      SpanIndexedField.PROJECT,
      SpanIndexedField.TRACE,
      SpanIndexedField.TRANSACTION_ID,
      SpanIndexedField.ID,
      SpanIndexedField.TIMESTAMP,
      SpanIndexedField.SPAN_DESCRIPTION,
      SpanIndexedField.CACHE_HIT,
      SpanIndexedField.SPAN_OP,
      SpanIndexedField.CACHE_ITEM_SIZE,
    ],
    sorts: [SPAN_SAMPLES_SORT],
    limit: SPAN_SAMPLE_LIMIT,
    enabled: isPanelOpen,
    referrer: Referrer.SAMPLES_CACHE_SPAN_SAMPLES,
  });

  const {
    data: transactionData,
    error: transactionError,
    isFetching: isFetchingTransactions,
  } = useTransactions(
    cacheSpanSamplesData?.map(span => span['transaction.id']) || [],
    Referrer.SAMPLES_CACHE_SPAN_SAMPLES
  );

  const transactionDurationsMap = keyBy(transactionData, 'id');

  const spansWithDuration =
    cacheSpanSamplesData?.map(span => ({
      ...span,
      'transaction.duration':
        transactionDurationsMap[span['transaction.id']]?.['transaction.duration'],
    })) || [];

  const {projects} = useProjects();
  const project = projects.find(p => query.project === p.id);

  const handleClose = () => {
    router.replace({
      pathname: router.location.pathname,
      query: {
        ...router.location.query,
        transaction: undefined,
        transactionMethod: undefined,
      },
    });
  };

  return (
    <PageAlertProvider>
      <DetailPanel detailKey={detailKey} onClose={handleClose}>
        <ModuleLayout.Layout>
          <ModuleLayout.Full>
            <HeaderContainer>
              {project && (
                <SpanSummaryProjectAvatar
                  project={project}
                  direction="left"
                  size={40}
                  hasTooltip
                  tooltip={project.slug}
                />
              )}
              <TitleContainer>
                <Title>
                  <Link
                    to={normalizeUrl(
                      `/organizations/${organization.slug}/performance/summary?${qs.stringify(
                        {
                          project: query.project,
                          transaction: query.transaction,
                        }
                      )}`
                    )}
                  >
                    {query.transaction}
                  </Link>
                </Title>
              </TitleContainer>
            </HeaderContainer>
          </ModuleLayout.Full>

          <ModuleLayout.Full>
            <MetricsRibbon>
              <MetricReadout
                align="left"
                title={getThroughputTitle('cache')}
                value={cacheTransactionMetrics?.[0]?.[`${SpanFunction.SPM}()`]}
                unit={RateUnit.PER_MINUTE}
                isLoading={areCacheTransactionMetricsFetching}
              />

              <MetricReadout
                align="left"
                title={DataTitles.cacheMissRate}
                value={
                  cacheTransactionMetrics?.[0]?.[`${SpanFunction.CACHE_MISS_RATE}()`]
                }
                unit="percentage"
                isLoading={areCacheTransactionMetricsFetching}
              />

              <MetricReadout
                align="left"
                title={DataTitles.timeSpent}
                value={cacheTransactionMetrics?.[0]?.['sum(span.self_time)']}
                unit={DurationUnit.MILLISECOND}
                tooltip={getTimeSpentExplanation(
                  cacheTransactionMetrics?.[0]?.['time_spent_percentage()']
                )}
                isLoading={areCacheTransactionMetricsFetching}
              />
            </MetricsRibbon>
          </ModuleLayout.Full>

          <Fragment>
            <ModuleLayout.Full>
              <TransactionDurationChart />
            </ModuleLayout.Full>
          </Fragment>
          <Fragment>
            <ModuleLayout.Full>
              <SpanSamplesTable
                data={spansWithDuration ?? []}
                meta={{
                  fields: {
                    'transaction.duration': 'duration',
                    [SpanIndexedField.CACHE_ITEM_SIZE]: 'size',
                  },
                  units: {[SpanIndexedField.CACHE_ITEM_SIZE]: 'byte'},
                }}
                isLoading={isCacheSpanSamplesFetching || isFetchingTransactions}
                error={transactionError}
              />
            </ModuleLayout.Full>
          </Fragment>

          <Fragment>
            <ModuleLayout.Full>
              <Button onClick={() => refetchSpanSamples()}>
                {t('Try Different Samples')}
              </Button>
            </ModuleLayout.Full>
          </Fragment>
        </ModuleLayout.Layout>
      </DetailPanel>
    </PageAlertProvider>
  );
}

const SPAN_SAMPLE_LIMIT = 10;

const SPAN_SAMPLES_SORT = {
  field: 'span_id',
  kind: 'desc' as const,
};

const SpanSummaryProjectAvatar = styled(ProjectAvatar)`
  padding-right: ${space(1)};
`;

const HeaderContainer = styled('div')`
  display: grid;
  grid-template-rows: auto auto auto;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-rows: auto;
    grid-template-columns: auto 1fr auto;
  }
`;

const TitleContainer = styled('div')`
  width: 100%;
  position: relative;
  height: 40px;
`;

const Title = styled('h4')`
  position: absolute;
  bottom: 0;
  margin-bottom: 0;
`;

const MetricsRibbon = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(4)};
`;
