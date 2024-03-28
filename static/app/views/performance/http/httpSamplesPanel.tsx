import {Link} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series} from 'sentry/types/echarts';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {DurationChart} from 'sentry/views/performance/http/durationChart';
import decodePanel from 'sentry/views/performance/http/queryParameterDecoders/panel';
import {ResponseCodeBarChart} from 'sentry/views/performance/http/responseCodeBarChart';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import {getTimeSpentExplanation} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {
  ModuleName,
  SpanFunction,
  SpanMetricsField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/starfish/types';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';

export function HTTPSamplesPanel() {
  const router = useRouter();
  const location = useLocation();

  const query = useLocationQuery({
    fields: {
      project: decodeScalar,
      domain: decodeScalar,
      transaction: decodeScalar,
      transactionMethod: decodeScalar,
      panel: decodePanel,
    },
  });

  const organization = useOrganization();

  const {projects} = useProjects();
  const project = projects.find(p => query.project === p.id);

  // `detailKey` controls whether the panel is open. If all required properties are available, concat them to make a key, otherwise set to `undefined` and hide the panel
  const detailKey =
    query.transaction && query.domain
      ? [query.domain, query.transactionMethod, query.transaction]
          .filter(Boolean)
          .join(':')
      : undefined;

  const handlePanelChange = newPanelName => {
    router.replace({
      pathname: location.pathname,
      query: {
        ...location.query,
        panel: newPanelName,
      },
    });
  };

  const isPanelOpen = Boolean(detailKey);

  const filters: SpanMetricsQueryFilters = {
    'span.module': ModuleName.HTTP,
    'span.domain': query.domain,
    transaction: query.transaction,
  };

  const {
    data: domainTransactionMetrics,
    isFetching: areDomainTransactionMetricsFetching,
  } = useSpanMetrics({
    search: MutableSearch.fromQueryObject(filters),
    fields: [
      `${SpanFunction.SPM}()`,
      `avg(${SpanMetricsField.SPAN_SELF_TIME})`,
      `sum(${SpanMetricsField.SPAN_SELF_TIME})`,
      'http_response_rate(3)',
      'http_response_rate(4)',
      'http_response_rate(5)',
      `${SpanFunction.TIME_SPENT_PERCENTAGE}()`,
    ],
    enabled: isPanelOpen,
    referrer: 'api.starfish.http-module-samples-panel-metrics-ribbon',
  });

  const {
    isFetching: isDurationDataFetching,
    data: durationData,
    error: durationError,
  } = useSpanMetricsSeries({
    search: MutableSearch.fromQueryObject(filters),
    yAxis: [`avg(span.self_time)`],
    enabled: isPanelOpen && query.panel === 'duration',
    referrer: 'api.starfish.http-module-samples-panel-duration-chart',
  });

  const {
    data: responseCodeData,
    isFetching: isResponseCodeDataLoading,
    error: responseCodeDataError,
  } = useSpanMetrics({
    search: MutableSearch.fromQueryObject(filters),
    fields: ['span.status_code', 'count()'],
    sorts: [{field: 'span.status_code', kind: 'asc'}],
    enabled: isPanelOpen && query.panel === 'status',
    referrer: 'api.starfish.http-module-samples-panel-response-bar-chart',
  });

  const responseCodeBarChartSeries: Series = {
    seriesName: 'span.status_code',
    data: (responseCodeData ?? []).map(item => {
      return {
        name: item['span.status_code'] || t('N/A'),
        value: item['count()'],
      };
    }),
  };

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
                    {query.transaction &&
                    query.transactionMethod &&
                    !query.transaction.startsWith(query.transactionMethod)
                      ? `${query.transactionMethod} ${query.transaction}`
                      : query.transaction}
                  </Link>
                </Title>
              </TitleContainer>
            </HeaderContainer>
          </ModuleLayout.Full>

          <ModuleLayout.Full>
            <MetricsRibbon>
              <MetricReadout
                align="left"
                title={getThroughputTitle('http')}
                value={domainTransactionMetrics?.[0]?.[`${SpanFunction.SPM}()`]}
                unit={RateUnit.PER_MINUTE}
                isLoading={areDomainTransactionMetricsFetching}
              />

              <MetricReadout
                align="left"
                title={DataTitles.avg}
                value={
                  domainTransactionMetrics?.[0]?.[
                    `avg(${SpanMetricsField.SPAN_SELF_TIME})`
                  ]
                }
                unit={DurationUnit.MILLISECOND}
                isLoading={areDomainTransactionMetricsFetching}
              />

              <MetricReadout
                align="left"
                title={t('3XXs')}
                value={domainTransactionMetrics?.[0]?.[`http_response_rate(3)`]}
                unit="percentage"
                isLoading={areDomainTransactionMetricsFetching}
              />

              <MetricReadout
                align="left"
                title={t('4XXs')}
                value={domainTransactionMetrics?.[0]?.[`http_response_rate(4)`]}
                unit="percentage"
                isLoading={areDomainTransactionMetricsFetching}
              />

              <MetricReadout
                align="left"
                title={t('5XXs')}
                value={domainTransactionMetrics?.[0]?.[`http_response_rate(5)`]}
                unit="percentage"
                isLoading={areDomainTransactionMetricsFetching}
              />

              <MetricReadout
                align="left"
                title={DataTitles.timeSpent}
                value={domainTransactionMetrics?.[0]?.['sum(span.self_time)']}
                unit={DurationUnit.MILLISECOND}
                tooltip={getTimeSpentExplanation(
                  domainTransactionMetrics?.[0]?.['time_spent_percentage()'],
                  'db'
                )}
                isLoading={areDomainTransactionMetricsFetching}
              />
            </MetricsRibbon>
          </ModuleLayout.Full>

          <ModuleLayout.Full>
            <SegmentedControl
              value={query.panel}
              onChange={handlePanelChange}
              aria-label={t('Choose breakdown type')}
            >
              <SegmentedControl.Item key="duration">
                {t('By Duration')}
              </SegmentedControl.Item>
              <SegmentedControl.Item key="status">
                {t('By Response Code')}
              </SegmentedControl.Item>
            </SegmentedControl>
          </ModuleLayout.Full>

          <ModuleLayout.Full>
            {query.panel === 'duration' && (
              <DurationChart
                series={durationData[`avg(span.self_time)`]}
                isLoading={isDurationDataFetching}
                error={durationError}
              />
            )}

            {query.panel === 'status' && (
              <ResponseCodeBarChart
                series={responseCodeBarChartSeries}
                isLoading={isResponseCodeDataLoading}
                error={responseCodeDataError}
              />
            )}
          </ModuleLayout.Full>
        </ModuleLayout.Layout>
      </DetailPanel>
    </PageAlertProvider>
  );
}

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
