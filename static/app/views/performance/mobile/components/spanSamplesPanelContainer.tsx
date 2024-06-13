import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import Feature from 'sentry/components/acl/feature';
import SearchBar from 'sentry/components/events/searchBar';
import {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DurationUnit} from 'sentry/utils/discover/fields';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {MetricReadout} from 'sentry/views/performance/metricReadout';
import useCrossPlatformProject from 'sentry/views/performance/mobile/useCrossPlatformProject';
import {useSpanFieldSupportedTags} from 'sentry/views/performance/utils/useSpanFieldSupportedTags';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useDiscover';
import {
  type ModuleName,
  SpanMetricsField,
  type SpanMetricsQueryFilters,
} from 'sentry/views/starfish/types';
import {formatVersionAndCenterTruncate} from 'sentry/views/starfish/utils/centerTruncate';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import DurationChart from 'sentry/views/starfish/views/spanSummaryPage/sampleList/durationChart';
import SampleTable from 'sentry/views/starfish/views/spanSummaryPage/sampleList/sampleTable/sampleTable';

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
  const router = useRouter();
  const [highlightedSpanId, setHighlightedSpanId] = useState<string | undefined>(
    undefined
  );
  const {selectedPlatform, isProjectCrossPlatform} = useCrossPlatformProject();

  const organization = useOrganization();
  const {selection} = usePageFilters();
  const supportedTags = useSpanFieldSupportedTags();

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

  const {data} = useSpanMetrics(
    {
      search: MutableSearch.fromQueryObject({...filters, ...additionalFilters}),
      fields: [`avg(${SPAN_SELF_TIME})`, 'count()', SPAN_OP],
      enabled: Boolean(groupId) && Boolean(transactionName),
    },
    'api.starfish.span-summary-panel-samples-table-avg'
  );

  const spanMetrics = data[0] ?? {};

  const handleSearch = (newSearchQuery: string) => {
    router.replace({
      pathname: location.pathname,
      query: {
        ...location.query,
        ...(searchQueryKey && {[searchQueryKey]: newSearchQuery}),
      },
    });
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

      <Container>
        <MetricReadout
          title={DataTitles.avg}
          align="left"
          value={spanMetrics?.[`avg(${SPAN_SELF_TIME})`]}
          unit={DurationUnit.MILLISECOND}
        />
        <MetricReadout
          title={DataTitles.count}
          align="left"
          value={spanMetrics?.['count()'] ?? 0}
          unit="count"
        />
      </Container>

      <DurationChart
        spanSearch={spanSearch}
        additionalFilters={additionalFilters}
        groupId={groupId}
        transactionName={transactionName}
        transactionMethod={transactionMethod}
        onClickSample={span => {
          router.push(
            generateLinkToEventInTraceView({
              eventId: span['transaction.id'],
              projectSlug: span.project,
              spanId: span.span_id,
              location,
              organization,
              traceSlug: span.trace,
              timestamp: span.timestamp,
            })
          );
        }}
        onMouseOverSample={sample => debounceSetHighlightedSpanId(sample.span_id)}
        onMouseLeaveSample={() => debounceSetHighlightedSpanId(undefined)}
        highlightedSpanId={highlightedSpanId}
        release={release}
        platform={isProjectCrossPlatform ? selectedPlatform : undefined}
      />

      <Feature features="performance-sample-panel-search">
        <StyledSearchBar
          searchSource={`${moduleName}-sample-panel`}
          query={searchQuery}
          onSearch={handleSearch}
          placeholder={t('Search for span attributes')}
          organization={organization}
          metricAlert={false}
          supportedTags={supportedTags}
          dataset={DiscoverDatasets.SPANS_INDEXED}
          projectIds={selection.projects}
        />
      </Feature>
      <SampleTable
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

const SectionTitle = styled('div')`
  ${p => p.theme.text.cardTitle}
`;

const PaddedTitle = styled('div')`
  margin-bottom: ${space(1)};
`;

const Container = styled('div')`
  display: flex;
`;

const StyledSearchBar = styled(SearchBar)`
  margin-top: ${space(2)};
`;
