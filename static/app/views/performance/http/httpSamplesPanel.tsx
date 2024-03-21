import {Link} from 'react-router';
import styled from '@emotion/styled';
import * as qs from 'query-string';

import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit, RateUnit} from 'sentry/utils/discover/fields';
import {PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import {getTimeSpentExplanation} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {
  ModuleName,
  SpanFunction,
  SpanMetricsField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/starfish/types';
import {DataTitles, getThroughputTitle} from 'sentry/views/starfish/views/spans/types';

type Query = {
  domain?: string;
  project?: string;
  transaction?: string;
  transactionMethod?: string;
};

export function HTTPSamplesPanel() {
  const location = useLocation<Query>();
  const query = location.query;

  const router = useRouter();

  const organization = useOrganization();

  const projectId = decodeScalar(query.project);

  const {projects} = useProjects();
  const project = projects.find(p => projectId === p.id);

  // `detailKey` controls whether the panel is open. If all required properties are available, concat them to make a key, otherwise set to `undefined` and hide the panel
  const detailKey =
    query.transaction && query.domain
      ? [query.domain, query.transactionMethod, query.transaction]
          .filter(Boolean)
          .join(':')
      : undefined;

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
              domainTransactionMetrics?.[0]?.[`avg(${SpanMetricsField.SPAN_SELF_TIME})`]
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
      </DetailPanel>
    </PageAlertProvider>
  );
}

const SpanSummaryProjectAvatar = styled(ProjectAvatar)`
  padding-right: ${space(1)};
`;

const HeaderContainer = styled('div')`
  width: 100%;
  padding-bottom: ${space(2)};
  padding-top: ${space(1)};

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
