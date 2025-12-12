import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {EventDrawerHeader} from 'sentry/components/events/eventDrawer';
import {useSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import useRouter from 'sentry/utils/useRouter';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {DATA_TYPE} from 'sentry/views/insights/browser/resources/settings';
import decodeSubregions from 'sentry/views/insights/browser/resources/utils/queryParameterDecoders/subregions';
import {SampleDrawerBody} from 'sentry/views/insights/common/components/sampleDrawerBody';
import {SampleDrawerHeaderTransaction} from 'sentry/views/insights/common/components/sampleDrawerHeaderTransaction';
import {DEFAULT_COLUMN_ORDER} from 'sentry/views/insights/common/components/samplesTable/spanSamplesTable';
import type {
  NonDefaultSpanSampleFields,
  SpanSample,
} from 'sentry/views/insights/common/queries/useSpanSamples';
import DurationChart from 'sentry/views/insights/common/views/spanSummaryPage/sampleList/durationChart';
import SampleInfo from 'sentry/views/insights/common/views/spanSummaryPage/sampleList/sampleInfo';
import SampleTable from 'sentry/views/insights/common/views/spanSummaryPage/sampleList/sampleTable/sampleTable';
import {InsightsSpanTagProvider} from 'sentry/views/insights/pages/insightsSpanTagProvider';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {ModuleName, SpanFields} from 'sentry/views/insights/types';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';

const {HTTP_RESPONSE_CONTENT_LENGTH, SPAN_DESCRIPTION} = SpanFields;

interface SampleListSearchQueryBuilderProps {
  handleSearch: (query: string) => void;
  moduleName: ModuleName;
  query: string;
  selection: PageFilters;
}

function SampleListSearchQueryBuilder({
  query,
  handleSearch,
  selection,
  moduleName,
}: SampleListSearchQueryBuilderProps) {
  const {spanSearchQueryBuilderProps} = useSpanSearchQueryBuilderProps({
    projects: selection.projects,
    initialQuery: query,
    onSearch: handleSearch,
    placeholder: t('Search for span attributes'),
    searchSource: `${moduleName}-sample-panel`,
  });

  return <TraceItemSearchQueryBuilder {...spanSearchQueryBuilderProps} />;
}

type Props = {
  groupId: string;
  moduleName: ModuleName;
  referrer?: string;
  transactionRoute?: string;
};

export function SampleList({groupId, moduleName, transactionRoute, referrer}: Props) {
  const organization = useOrganization();
  const {view} = useDomainViewFilters();

  const {
    transaction: transactionName,
    transactionMethod,
    [SpanFields.USER_GEO_SUBREGION]: subregions,
  } = useLocationQuery({
    fields: {
      transaction: decodeScalar,
      transactionMethod: decodeScalar,
      [SpanFields.USER_GEO_SUBREGION]: decodeSubregions,
    },
  });

  const router = useRouter();
  const [highlightedSpanId, setHighlightedSpanId] = useState<string | undefined>(
    undefined
  );

  transactionRoute ??= `/${getTransactionSummaryBaseUrl(organization, view, true)}`;

  const {selection} = usePageFilters();
  const location = useLocation();
  const {projects} = useProjects();

  const spanSearchQuery = decodeScalar(location.query.spanSearchQuery);

  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  const handleSearch = (newSpanSearchQuery: string) => {
    router.replace({
      pathname: location.pathname,
      query: {
        ...location.query,
        spanSearchQuery: newSpanSearchQuery,
      },
    });
  };

  // set additional query filters from the span search bar and the `query` param
  const spanSearch = new MutableSearch(spanSearchQuery ?? '');
  if (location.query.query) {
    (Array.isArray(location.query.query)
      ? location.query.query
      : [location.query.query]
    ).forEach(filter => {
      spanSearch.addStringFilter(filter);
    });
  }

  let columnOrder = DEFAULT_COLUMN_ORDER;

  const additionalFields: NonDefaultSpanSampleFields[] = [SpanFields.TRACE];

  if (moduleName === ModuleName.RESOURCE) {
    additionalFields?.push(SpanFields.HTTP_RESPONSE_CONTENT_LENGTH);
    additionalFields?.push(SpanFields.SPAN_DESCRIPTION);

    columnOrder = [
      ...DEFAULT_COLUMN_ORDER,
      {
        key: HTTP_RESPONSE_CONTENT_LENGTH,
        name: t('Encoded Size'),
        width: COL_WIDTH_UNDEFINED,
      },
      {
        key: SPAN_DESCRIPTION,
        name: `${DATA_TYPE} ${t('Name')}`,
        width: COL_WIDTH_UNDEFINED,
      },
    ];
  }

  const handleClickSample = useCallback(
    (span: SpanSample) => {
      router.push(
        generateLinkToEventInTraceView({
          targetId: span['transaction.span_id'],
          spanId: span.span_id,
          location,
          organization,
          traceSlug: span.trace,
          timestamp: span.timestamp,
        })
      );
    },
    [organization, location, router]
  );

  const handleMouseOverSample = useCallback(
    (sample: SpanSample) => setHighlightedSpanId(sample.span_id),
    []
  );

  const handleMouseLeaveSample = useCallback(() => setHighlightedSpanId(undefined), []);

  return (
    <PageAlertProvider>
      <InsightsSpanTagProvider>
        <EventDrawerHeader>
          <SampleDrawerHeaderTransaction
            project={project}
            transaction={transactionName}
            transactionMethod={transactionMethod}
          />
        </EventDrawerHeader>

        <SampleDrawerBody>
          <PageAlert />

          <SampleInfo
            groupId={groupId}
            transactionName={transactionName}
            transactionMethod={transactionMethod}
            subregions={subregions}
          />

          <DurationChart
            groupId={groupId}
            transactionName={transactionName}
            transactionMethod={transactionMethod}
            subregions={subregions}
            additionalFields={additionalFields}
            onClickSample={handleClickSample}
            onMouseOverSample={handleMouseOverSample}
            onMouseLeaveSample={handleMouseLeaveSample}
            spanSearch={spanSearch}
            highlightedSpanId={highlightedSpanId}
          />

          <StyledSearchBar>
            <SampleListSearchQueryBuilder
              query={spanSearchQuery ?? ''}
              moduleName={moduleName}
              selection={selection}
              handleSearch={handleSearch}
            />
          </StyledSearchBar>

          <SampleTable
            highlightedSpanId={highlightedSpanId}
            transactionMethod={transactionMethod}
            onMouseLeaveSample={() => setHighlightedSpanId(undefined)}
            onMouseOverSample={sample => setHighlightedSpanId(sample.span_id)}
            groupId={groupId}
            moduleName={moduleName}
            transactionName={transactionName}
            subregions={subregions}
            spanSearch={spanSearch}
            columnOrder={columnOrder}
            additionalFields={additionalFields}
            referrer={referrer}
          />
        </SampleDrawerBody>
      </InsightsSpanTagProvider>
    </PageAlertProvider>
  );
}

const StyledSearchBar = styled('div')`
  margin: ${space(2)} 0;
`;
