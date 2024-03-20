import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import ResourceInfo from 'sentry/views/performance/browser/resources/resourceSummaryPage/resourceInfo';
import ResourceSummaryCharts from 'sentry/views/performance/browser/resources/resourceSummaryPage/resourceSummaryCharts';
import ResourceSummaryTable from 'sentry/views/performance/browser/resources/resourceSummaryPage/resourceSummaryTable';
import SampleImages from 'sentry/views/performance/browser/resources/resourceSummaryPage/sampleImages';
import {FilterOptionsContainer} from 'sentry/views/performance/browser/resources/resourceView';
import {IMAGE_FILE_EXTENSIONS} from 'sentry/views/performance/browser/resources/shared/constants';
import RenderBlockingSelector from 'sentry/views/performance/browser/resources/shared/renderBlockingSelector';
import {ResourceSpanOps} from 'sentry/views/performance/browser/resources/shared/types';
import {useResourceModuleFilters} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {SpanMetricsField} from 'sentry/views/starfish/types';
import {SampleList} from 'sentry/views/starfish/views/spanSummaryPage/sampleList';

const {
  SPAN_SELF_TIME,
  SPAN_DESCRIPTION,
  HTTP_DECODED_RESPONSE_CONTENT_LENGTH,
  HTTP_RESPONSE_CONTENT_LENGTH,
  HTTP_RESPONSE_TRANSFER_SIZE,
  RESOURCE_RENDER_BLOCKING_STATUS,
  SPAN_OP,
} = SpanMetricsField;

function ResourceSummary() {
  const organization = useOrganization();
  const {groupId} = useParams();
  const filters = useResourceModuleFilters();
  const selectedSpanOp = filters[SPAN_OP];
  const {
    query: {transaction},
  } = useLocation();
  const {data} = useSpanMetrics({
    search: MutableSearch.fromQueryObject({
      'span.group': groupId,
    }),
    fields: [
      `avg(${SPAN_SELF_TIME})`,
      `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
      `avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`,
      `avg(${HTTP_RESPONSE_TRANSFER_SIZE})`,
      `sum(${SPAN_SELF_TIME})`,
      'spm()',
      SPAN_OP,
      SPAN_DESCRIPTION,
      'time_spent_percentage()',
      'project.id',
    ],
  });
  const spanMetrics = selectedSpanOp
    ? data.find(item => item[SPAN_OP] === selectedSpanOp) ?? {}
    : data[0] ?? {};

  const uniqueSpanOps = new Set(data.map(item => item[SPAN_OP]));

  const isImage =
    filters[SPAN_OP] === ResourceSpanOps.IMAGE ||
    IMAGE_FILE_EXTENSIONS.includes(
      spanMetrics[SpanMetricsField.SPAN_DESCRIPTION]?.split('.').pop() || ''
    ) ||
    (uniqueSpanOps.size === 1 && spanMetrics[SPAN_OP] === ResourceSpanOps.IMAGE);
  return (
    <ModulePageProviders
      title={[t('Performance'), t('Resources'), t('Resource Summary')].join(' — ')}
      baseURL="/performance/browser/resources"
      features="starfish-browser-resource-module-ui"
    >
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              {
                label: 'Performance',
                to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
                preservePageFilters: true,
              },
              {
                label: 'Resources',
                to: normalizeUrl(
                  `/organizations/${organization.slug}/performance/browser/resources/`
                ),
                preservePageFilters: true,
              },
              {
                label: 'Resource Summary',
              },
            ]}
          />

          <Layout.Title>{spanMetrics[SpanMetricsField.SPAN_DESCRIPTION]}</Layout.Title>
        </Layout.HeaderContent>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <FloatingFeedbackWidget />
          <HeaderContainer>
            <FilterOptionsContainer columnCount={2}>
              <PageFilterBar condensed>
                <ProjectPageFilter />
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
              <RenderBlockingSelector
                value={filters[RESOURCE_RENDER_BLOCKING_STATUS] || ''}
              />
            </FilterOptionsContainer>
            <ResourceInfo
              avgContentLength={spanMetrics[`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`]}
              avgDecodedContentLength={
                spanMetrics[`avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`]
              }
              avgTransferSize={spanMetrics[`avg(${HTTP_RESPONSE_TRANSFER_SIZE})`]}
              avgDuration={spanMetrics[`avg(${SPAN_SELF_TIME})`]}
              throughput={spanMetrics['spm()']}
              timeSpentTotal={spanMetrics[`sum(${SPAN_SELF_TIME})`]}
              timeSpentPercentage={spanMetrics[`time_spent_percentage()`]}
              spanOp={spanMetrics[SPAN_OP]}
            />
          </HeaderContainer>
          {isImage && (
            <SampleImages groupId={groupId} projectId={data?.[0]?.['project.id']} />
          )}
          <ResourceSummaryCharts groupId={groupId} />
          <ResourceSummaryTable />
          <SampleList
            transactionRoute="/performance/browser/pageloads/"
            groupId={groupId}
            transactionName={transaction as string}
            additionalFields={[HTTP_RESPONSE_CONTENT_LENGTH]}
          />
        </Layout.Main>
      </Layout.Body>
    </ModulePageProviders>
  );
}

const HeaderContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
`;

export default ResourceSummary;
