import React from 'react';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {t, tct} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import ResourceSummaryCharts from 'sentry/views/insights/browser/resources/components/charts/resourceSummaryCharts';
import RenderBlockingSelector from 'sentry/views/insights/browser/resources/components/renderBlockingSelector';
import ResourceInfo from 'sentry/views/insights/browser/resources/components/resourceInfo';
import SampleImages from 'sentry/views/insights/browser/resources/components/sampleImages';
import ResourceSummaryTable from 'sentry/views/insights/browser/resources/components/tables/resourceSummaryTable';
import {IMAGE_FILE_EXTENSIONS} from 'sentry/views/insights/browser/resources/constants';
import {Referrer} from 'sentry/views/insights/browser/resources/referrer';
import {DATA_TYPE} from 'sentry/views/insights/browser/resources/settings';
import {ResourceSpanOps} from 'sentry/views/insights/browser/resources/types';
import {useResourceModuleFilters} from 'sentry/views/insights/browser/resources/utils/useResourceFilters';
import {HeaderContainer} from 'sentry/views/insights/common/components/headerContainer';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {useModuleBreadcrumbs} from 'sentry/views/insights/common/utils/useModuleBreadcrumbs';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {SampleList} from 'sentry/views/insights/common/views/spanSummaryPage/sampleList';
import {ModuleName, SpanMetricsField} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceMetadataHeader';

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
  const webVitalsModuleURL = useModuleURL('vital');
  const {groupId} = useParams();
  const filters = useResourceModuleFilters();
  const selectedSpanOp = filters[SPAN_OP];
  const {
    query: {transaction},
  } = useLocation();
  const {data, isPending} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject({
        'span.group': groupId,
        ...(filters[SpanMetricsField.USER_GEO_SUBREGION]
          ? {
              [SpanMetricsField.USER_GEO_SUBREGION]: `[${filters[SpanMetricsField.USER_GEO_SUBREGION].join(',')}]`,
            }
          : {}),
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
    },
    Referrer.RESOURCE_SUMMARY_METRICS_RIBBON
  );
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

  const crumbs = useModuleBreadcrumbs('resource');

  return (
    <React.Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              ...crumbs,
              {
                label: tct('[dataType] Summary', {dataType: DATA_TYPE}),
              },
            ]}
          />

          <Layout.Title>{spanMetrics[SpanMetricsField.SPAN_DESCRIPTION]}</Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <FeedbackWidgetButton />
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>

      <Layout.Body>
        <Layout.Main fullWidth>
          <ModuleLayout.Layout>
            <ModuleLayout.Full>
              <HeaderContainer>
                <ToolRibbon>
                  <PageFilterBar condensed>
                    <ProjectPageFilter />
                    <EnvironmentPageFilter />
                    <DatePageFilter />
                  </PageFilterBar>

                  <RenderBlockingSelector
                    value={filters[RESOURCE_RENDER_BLOCKING_STATUS] || ''}
                  />
                  <SubregionSelector />
                </ToolRibbon>
                <ResourceInfo
                  isLoading={isPending}
                  avgContentLength={spanMetrics[`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`]}
                  avgDecodedContentLength={
                    spanMetrics[`avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`]
                  }
                  avgTransferSize={spanMetrics[`avg(${HTTP_RESPONSE_TRANSFER_SIZE})`]}
                  avgDuration={spanMetrics[`avg(${SPAN_SELF_TIME})`]}
                  throughput={spanMetrics['spm()']}
                  timeSpentTotal={spanMetrics[`sum(${SPAN_SELF_TIME})`]}
                  timeSpentPercentage={spanMetrics[`time_spent_percentage()`]}
                />
              </HeaderContainer>
            </ModuleLayout.Full>

            {isImage && (
              <ModuleLayout.Full>
                <SampleImages groupId={groupId} projectId={data?.[0]?.['project.id']} />
              </ModuleLayout.Full>
            )}

            <ResourceSummaryCharts groupId={groupId} />

            <ModuleLayout.Full>
              <ResourceSummaryTable />
            </ModuleLayout.Full>

            <ModuleLayout.Full>
              <SampleList
                transactionRoute={webVitalsModuleURL}
                subregions={filters[SpanMetricsField.USER_GEO_SUBREGION]}
                groupId={groupId}
                moduleName={ModuleName.RESOURCE}
                transactionName={transaction as string}
                referrer={TraceViewSources.ASSETS_MODULE}
              />
            </ModuleLayout.Full>
          </ModuleLayout.Layout>
        </Layout.Main>
      </Layout.Body>
    </React.Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders
      moduleName="resource"
      pageTitle={`${DATA_TYPE} ${t('Summary')}`}
      features="insights-initial-modules"
    >
      <ResourceSummary />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
