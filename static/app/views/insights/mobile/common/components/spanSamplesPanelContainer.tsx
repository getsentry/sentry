import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {SpanSearchQueryBuilder} from 'sentry/components/performance/spanSearchQueryBuilder';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit} from 'sentry/utils/discover/fields';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {MetricReadout} from 'sentry/views/insights/common/components/metricReadout';
import {ReadoutRibbon} from 'sentry/views/insights/common/components/ribbon';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {formatVersionAndCenterTruncate} from 'sentry/views/insights/common/utils/centerTruncate';
import {DataTitles} from 'sentry/views/insights/common/views/spans/types';
import DurationChart from 'sentry/views/insights/common/views/spanSummaryPage/sampleList/durationChart';
import SampleTable from 'sentry/views/insights/common/views/spanSummaryPage/sampleList/sampleTable/sampleTable';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {
  type ModuleName,
  SpanMetricsField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';

const {SPAN_SELF_TIME, SPAN_OP} = SpanMetricsField;

type Props = {
  groupId: string;
  moduleName: ModuleName;
  transactionName: string;
  additionalFilters?: Record<string, string>;
  release?: string;
  searchQueryKey?: string;
  sectionSubtitle?: string;
  sectionTitle?: string;
  spanOp?: string;
  transactionMethod?: string;
};

export function SpanSamplesContainer({
  groupId,
  moduleName,
  transactionName,
  transactionMethod,
  release,
  searchQueryKey,
  spanOp,
  additionalFilters,
}: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const [highlightedSpanId, setHighlightedSpanId] = useState<string | undefined>(
    undefined
  );
  const {selectedPlatform, isProjectCrossPlatform} = useCrossPlatformProject();

  const organization = useOrganization();
  const {selection} = usePageFilters();

  const searchQuery =
    searchQueryKey !== undefined
      ? decodeScalar(location.query[searchQueryKey])
      : undefined;

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debounceSetHighlightedSpanId = useCallback(
    debounce(id => {
      setHighlightedSpanId(id);
    }, 10),
    []
  );

  const spanSearch = new MutableSearch(searchQuery ?? '');
  if (additionalFilters) {
    Object.entries(additionalFilters).forEach(([key, value]) => {
      spanSearch.addFilterValue(key, value);
    });
  }

  const filters: SpanMetricsQueryFilters = {
    'span.group': groupId,
    transaction: transactionName,
  };

  if (transactionMethod) {
    filters['transaction.method'] = transactionMethod;
  }

  if (release) {
    filters.release = release;
  }

  if (isProjectCrossPlatform) {
    filters['os.name'] = selectedPlatform;
  }

  if (spanOp) {
    filters['span.op'] = spanOp;
  }

  const {data, isPending} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject({...filters, ...additionalFilters}),
      fields: [`avg(${SPAN_SELF_TIME})`, 'count()', SPAN_OP],
      enabled: Boolean(groupId) && Boolean(transactionName),
    },
    'api.starfish.span-summary-panel-samples-table-avg'
  );

  const spanMetrics = data[0] ?? {};

  const handleSearch = (newSearchQuery: string) => {
    navigate(
      {
        pathname: location.pathname,
        query: {
          ...location.query,
          ...(searchQueryKey && {[searchQueryKey]: newSearchQuery}),
        },
      },
      {replace: true}
    );
  };

  return (
    <Fragment>
      <PaddedTitle>
        {release && (
          <SectionTitle>
            <Tooltip title={release}>
              <Link
                to={{
                  pathname: normalizeUrl(
                    `/organizations/${organization?.slug}/releases/${encodeURIComponent(
                      release
                    )}/`
                  ),
                }}
              >
                {formatVersionAndCenterTruncate(release)}
              </Link>
            </Tooltip>
          </SectionTitle>
        )}
      </PaddedTitle>

      <StyledReadoutRibbon>
        <MetricReadout
          title={DataTitles.avg}
          value={spanMetrics?.[`avg(${SPAN_SELF_TIME})`]}
          unit={DurationUnit.MILLISECOND}
          isLoading={isPending}
        />
        <MetricReadout
          title={DataTitles.count}
          value={spanMetrics?.['count()'] ?? 0}
          unit="count"
          isLoading={isPending}
        />
      </StyledReadoutRibbon>

      <DurationChart
        spanSearch={spanSearch}
        additionalFilters={additionalFilters}
        groupId={groupId}
        transactionName={transactionName}
        transactionMethod={transactionMethod}
        onClickSample={span => {
          navigate(
            generateLinkToEventInTraceView({
              eventId: span['transaction.id'],
              projectSlug: span.project,
              spanId: span.span_id,
              location,
              organization,
              traceSlug: span.trace,
              timestamp: span.timestamp,
              source: TraceViewSources.APP_STARTS_MODULE,
            })
          );
        }}
        onMouseOverSample={sample => debounceSetHighlightedSpanId(sample.span_id)}
        onMouseLeaveSample={() => debounceSetHighlightedSpanId(undefined)}
        highlightedSpanId={highlightedSpanId}
        release={release}
        platform={isProjectCrossPlatform ? selectedPlatform : undefined}
      />

      <StyledSearchBar>
        <SpanSearchQueryBuilder
          searchSource={`${moduleName}-sample-panel`}
          initialQuery={searchQuery ?? ''}
          onSearch={handleSearch}
          placeholder={t('Search for span attributes')}
          projects={selection.projects}
        />
      </StyledSearchBar>

      <SampleTable
        referrer={TraceViewSources.APP_STARTS_MODULE}
        spanSearch={spanSearch}
        additionalFilters={additionalFilters}
        highlightedSpanId={highlightedSpanId}
        transactionMethod={transactionMethod}
        onMouseLeaveSample={() => setHighlightedSpanId(undefined)}
        onMouseOverSample={sample => setHighlightedSpanId(sample.span_id)}
        groupId={groupId}
        transactionName={transactionName}
        moduleName={moduleName}
        release={release}
        columnOrder={[
          {
            key: 'span_id',
            name: t('Span ID'),
            width: COL_WIDTH_UNDEFINED,
          },
          {
            key: 'profile_id',
            name: t('Profile'),
            width: COL_WIDTH_UNDEFINED,
          },
          {
            key: 'avg_comparison',
            name: t('Compared to Average'),
            width: COL_WIDTH_UNDEFINED,
          },
        ]}
      />
    </Fragment>
  );
}

const StyledReadoutRibbon = styled(ReadoutRibbon)`
  margin-bottom: ${space(2)};
`;

const SectionTitle = styled('div')`
  ${p => p.theme.text.cardTitle}
`;

const PaddedTitle = styled('div')`
  margin-bottom: ${space(1)};
`;

const StyledSearchBar = styled('div')`
  margin: ${space(2)} 0;
`;
