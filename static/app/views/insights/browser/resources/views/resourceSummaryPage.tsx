import React from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useMaxPickableDays} from 'sentry/utils/useMaxPickableDays';
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
import {ModuleFeature} from 'sentry/views/insights/common/components/moduleFeature';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ToolRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {useModuleTitle} from 'sentry/views/insights/common/utils/useModuleTitle';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {useSamplesDrawer} from 'sentry/views/insights/common/utils/useSamplesDrawer';
import SubregionSelector from 'sentry/views/insights/common/views/spans/selectors/subregionSelector';
import {SampleList} from 'sentry/views/insights/common/views/spanSummaryPage/sampleList';
import {FrontendHeader} from 'sentry/views/insights/pages/frontend/frontendPageHeader';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';

const {
  SPAN_SELF_TIME,
  SPAN_DESCRIPTION,
  HTTP_DECODED_RESPONSE_CONTENT_LENGTH,
  HTTP_RESPONSE_CONTENT_LENGTH,
  HTTP_RESPONSE_TRANSFER_SIZE,
  RESOURCE_RENDER_BLOCKING_STATUS,
  SPAN_OP,
} = SpanFields;

function ResourceSummary() {
  const moduleTitle = useModuleTitle(ModuleName.RESOURCE);
  const moduleURL = useModuleURL(ModuleName.RESOURCE);
  const webVitalsModuleURL = useModuleURL('vital');
  const {groupId} = useParams();
  const filters = useResourceModuleFilters();
  const selectedSpanOp = filters[SPAN_OP];

  useSamplesDrawer({
    Component: (
      <SampleList
        groupId={groupId!}
        moduleName={ModuleName.RESOURCE}
        transactionRoute={webVitalsModuleURL}
        referrer={TraceViewSources.ASSETS_MODULE}
      />
    ),
    moduleName: ModuleName.RESOURCE,
    requiredParams: ['transaction'],
  });

  const {data, isPending} = useSpans(
    {
      search: MutableSearch.fromQueryObject({
        'span.group': groupId,
        ...(filters[SpanFields.USER_GEO_SUBREGION]
          ? {
              [SpanFields.USER_GEO_SUBREGION]: `[${filters[SpanFields.USER_GEO_SUBREGION].join(',')}]`,
            }
          : {}),
      }),
      fields: [
        `avg(${SPAN_SELF_TIME})`,
        `avg(${HTTP_RESPONSE_CONTENT_LENGTH})`,
        `avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`,
        `avg(${HTTP_RESPONSE_TRANSFER_SIZE})`,
        `sum(${SPAN_SELF_TIME})`,
        'epm()',
        SPAN_OP,
        SPAN_DESCRIPTION,
        'project.id',
      ],
    },
    Referrer.RESOURCE_SUMMARY_METRICS_RIBBON
  );
  const spanMetrics = selectedSpanOp
    ? [data.find(item => item[SPAN_OP] === selectedSpanOp)]
    : data;

  const uniqueSpanOps = new Set(data.map(item => item[SPAN_OP]));

  const isImage =
    filters[SPAN_OP] === ResourceSpanOps.IMAGE ||
    IMAGE_FILE_EXTENSIONS.includes(
      spanMetrics?.[0]?.[SpanFields.SPAN_DESCRIPTION]?.split('.').pop() || ''
    ) ||
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    (uniqueSpanOps.size === 1 && spanMetrics[SPAN_OP] === ResourceSpanOps.IMAGE);

  return (
    <React.Fragment>
      <FrontendHeader
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        headerTitle={spanMetrics[SpanFields.SPAN_DESCRIPTION]}
        breadcrumbs={[
          {
            label: moduleTitle,
            to: moduleURL,
          },
          {
            label: tct('[dataType] Summary', {dataType: DATA_TYPE}),
          },
        ]}
        module={ModuleName.RESOURCE}
        hideDefaultTabs
      />

      <ModuleFeature moduleName={ModuleName.RESOURCE}>
        <Layout.Body>
          <Layout.Main width="full">
            <ModuleLayout.Layout>
              <ModuleLayout.Full>
                <HeaderContainer>
                  <ToolRibbon>
                    <ModulePageFilterBar moduleName={ModuleName.RESOURCE} />
                    <RenderBlockingSelector
                      value={filters[RESOURCE_RENDER_BLOCKING_STATUS] || ''}
                    />
                    <SubregionSelector />
                  </ToolRibbon>
                  <ResourceInfo
                    isLoading={isPending}
                    avgContentLength={
                      spanMetrics?.[0]?.[`avg(${HTTP_RESPONSE_CONTENT_LENGTH})`] ?? 0
                    }
                    avgDecodedContentLength={
                      spanMetrics?.[0]?.[
                        `avg(${HTTP_DECODED_RESPONSE_CONTENT_LENGTH})`
                      ] ?? 0
                    }
                    avgTransferSize={
                      spanMetrics?.[0]?.[`avg(${HTTP_RESPONSE_TRANSFER_SIZE})`] ?? 0
                    }
                    avgDuration={spanMetrics?.[0]?.[`avg(${SPAN_SELF_TIME})`] ?? 0}
                    throughput={spanMetrics?.[0]?.[`epm()`] ?? 0}
                    timeSpentTotal={spanMetrics?.[0]?.[`sum(${SPAN_SELF_TIME})`] ?? 0}
                  />
                </HeaderContainer>
              </ModuleLayout.Full>

              {isImage && (
                <ModuleLayout.Full>
                  <SampleImages
                    groupId={groupId!}
                    projectId={data?.[0]?.['project.id']}
                  />
                </ModuleLayout.Full>
              )}

              <ResourceSummaryCharts />

              <ModuleLayout.Full>
                <ResourceSummaryTable />
              </ModuleLayout.Full>
            </ModuleLayout.Layout>
          </Layout.Main>
        </Layout.Body>
      </ModuleFeature>
    </React.Fragment>
  );
}

function PageWithProviders() {
  const maxPickableDays = useMaxPickableDays({
    dataCategories: [DataCategory.SPANS],
  });

  return (
    <ModulePageProviders
      moduleName="resource"
      pageTitle={`${DATA_TYPE} ${t('Summary')}`}
      maxPickableDays={maxPickableDays.maxPickableDays}
    >
      <ResourceSummary />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
