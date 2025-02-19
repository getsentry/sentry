import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import type {GridColumnHeader} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {IconProfiling} from 'sentry/icons/iconProfiling';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {DurationComparisonCell} from 'sentry/views/insights/common/components/samplesTable/common';
import {DurationCell} from 'sentry/views/insights/common/components/tableCells/durationCell';
import FilenameCell from 'sentry/views/insights/common/components/tableCells/filenameCell';
import ResourceSizeCell from 'sentry/views/insights/common/components/tableCells/resourceSizeCell';
import {
  OverflowEllipsisTextContainer,
  TextAlignRight,
} from 'sentry/views/insights/common/components/textAlign';
import type {SpanSample} from 'sentry/views/insights/common/queries/useSpanSamples';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {type ModuleName, SpanMetricsField} from 'sentry/views/insights/types';
import type {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';

const {HTTP_RESPONSE_CONTENT_LENGTH, SPAN_DESCRIPTION} = SpanMetricsField;

type Keys =
  | 'transaction_id'
  | 'span_id'
  | 'profile_id'
  | 'timestamp'
  | 'duration'
  | 'p95_comparison'
  | 'avg_comparison'
  | 'http.response_content_length'
  | 'span.description';
export type SamplesTableColumnHeader = GridColumnHeader<Keys>;

export const DEFAULT_COLUMN_ORDER: SamplesTableColumnHeader[] = [
  {
    key: 'span_id',
    name: 'Span ID',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'duration',
    name: 'Span Duration',
    width: COL_WIDTH_UNDEFINED,
  },
  {
    key: 'avg_comparison',
    name: 'Compared to Average',
    width: COL_WIDTH_UNDEFINED,
  },
];

type SpanTableRow = {
  op: string;
  trace: string;
  transaction: {
    'project.name': string;
    timestamp: string;
    'transaction.duration': number;
  };
  'transaction.id': string;
} & SpanSample;

type Props = {
  avg: number;
  data: SpanTableRow[];
  groupId: string;
  isLoading: boolean;
  moduleName: ModuleName;
  columnOrder?: SamplesTableColumnHeader[];
  highlightedSpanId?: string;
  onMouseLeaveSample?: () => void;
  onMouseOverSample?: (sample: SpanSample) => void;
  source?: TraceViewSources;
};

export function SpanSamplesTable({
  groupId,
  isLoading,
  data,
  avg,
  moduleName,
  highlightedSpanId,
  onMouseLeaveSample,
  onMouseOverSample,
  columnOrder,
  source,
}: Props) {
  const location = useLocation();
  const organization = useOrganization();
  const {view} = useDomainViewFilters();

  function renderHeadCell(column: GridColumnHeader): React.ReactNode {
    if (
      column.key === 'p95_comparison' ||
      column.key === 'avg_comparison' ||
      column.key === 'duration' ||
      column.key === HTTP_RESPONSE_CONTENT_LENGTH
    ) {
      return (
        <TextAlignRight>
          <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>
        </TextAlignRight>
      );
    }

    return <OverflowEllipsisTextContainer>{column.name}</OverflowEllipsisTextContainer>;
  }

  function renderBodyCell(column: GridColumnHeader, row: SpanTableRow): React.ReactNode {
    if (column.key === 'transaction_id') {
      return (
        <Link
          to={generateLinkToEventInTraceView({
            eventId: row['transaction.id'],
            timestamp: row.timestamp,
            traceSlug: row.trace,
            projectSlug: row.project,
            organization,
            location: {
              ...location,
              query: {
                ...location.query,
                groupId,
              },
            },
            spanId: row.span_id,
            source,
            view,
          })}
        >
          {row['transaction.id'].slice(0, 8)}
        </Link>
      );
    }

    if (column.key === 'span_id') {
      return (
        <Link
          onClick={() =>
            trackAnalytics('performance_views.sample_spans.span_clicked', {
              organization,
              source: moduleName,
            })
          }
          to={generateLinkToEventInTraceView({
            eventId: row['transaction.id'],
            timestamp: row.timestamp,
            traceSlug: row.trace,
            projectSlug: row.project,
            organization,
            location: {
              ...location,
              query: {
                ...location.query,
                groupId,
              },
            },
            spanId: row.span_id,
            source,
            view,
          })}
        >
          {row.span_id}
        </Link>
      );
    }

    if (column.key === HTTP_RESPONSE_CONTENT_LENGTH) {
      const size = parseInt(row[HTTP_RESPONSE_CONTENT_LENGTH], 10);
      return <ResourceSizeCell bytes={size} />;
    }

    if (column.key === SPAN_DESCRIPTION) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      return <FilenameCell url={row[SPAN_DESCRIPTION]} />;
    }

    if (column.key === 'profile_id') {
      return (
        <IconWrapper>
          {row.profile_id ? (
            <Tooltip title={t('View Profile')}>
              <LinkButton
                to={normalizeUrl(
                  `/organizations/${organization.slug}/profiling/profile/${row.project}/${row.profile_id}/flamegraph/?spanId=${row.span_id}`
                )}
                size="xs"
              >
                <IconProfiling size="xs" />
              </LinkButton>
            </Tooltip>
          ) : (
            <div>(no value)</div>
          )}
        </IconWrapper>
      );
    }

    if (column.key === 'duration') {
      return <DurationCell milliseconds={row['span.self_time']} />;
    }

    if (column.key === 'avg_comparison') {
      return (
        <DurationComparisonCell
          duration={row['span.self_time']}
          compareToDuration={avg}
        />
      );
    }

    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return <span>{row[column.key]}</span>;
  }

  return (
    <GridEditable
      isLoading={isLoading}
      data={data}
      columnOrder={columnOrder ?? DEFAULT_COLUMN_ORDER}
      columnSortBy={[]}
      onRowMouseOver={onMouseOverSample}
      onRowMouseOut={onMouseLeaveSample}
      highlightedRowKey={data.findIndex(sample => sample.span_id === highlightedSpanId)}
      grid={{
        renderHeadCell,
        renderBodyCell,
      }}
    />
  );
}

const IconWrapper = styled('div')`
  text-align: right;
  width: 100%;
  height: 26px;
`;
