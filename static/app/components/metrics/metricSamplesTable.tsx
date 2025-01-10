import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptorObject} from 'history';
import debounce from 'lodash/debounce';

import {Button, LinkButton} from 'sentry/components/button';
import {Flex} from 'sentry/components/container/flex';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import SmartSearchBar from 'sentry/components/deprecatedSmartSearchBar';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import {Hovercard} from 'sentry/components/hovercard';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import type {SelectionRange} from 'sentry/components/metrics/chart/types';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {Tooltip} from 'sentry/components/tooltip';
import {IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DateString, PageFilters} from 'sentry/types/core';
import type {MetricAggregation, MRI} from 'sentry/types/metrics';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {Container, FieldDateTime, NumberContainer} from 'sentry/utils/discover/styles';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {isVirtualMetric} from 'sentry/utils/metrics';
import {formatMetricUsingUnit} from 'sentry/utils/metrics/formatters';
import {formatMRI, parseMRI} from 'sentry/utils/metrics/mri';
import {
  type Field as SelectedField,
  getSummaryValueForAggregation,
  type MetricsSamplesResults,
  type ResultField,
  type Summary,
  useMetricsSamples,
} from 'sentry/utils/metrics/useMetricsSamples';
import {useVirtualMetricsContext} from 'sentry/utils/metrics/virtualMetricsContext';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import Projects from 'sentry/utils/projects';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';
import {transactionSummaryRouteWithQuery} from 'sentry/views/performance/transactionSummary/utils';
import ColorBar from 'sentry/views/performance/vitalDetail/colorBar';

const fields: SelectedField[] = [
  'project',
  'id',
  'span.op',
  'span.description',
  'span.duration',
  'span.self_time',
  'timestamp',
  'trace',
  'transaction',
  'transaction.id',
  'profile.id',
];

export type Field = (typeof fields)[number];

interface MetricsSamplesTableProps {
  aggregation?: MetricAggregation;
  condition?: number;
  focusArea?: SelectionRange;
  hasPerformance?: boolean;
  mri?: MRI;
  onRowHover?: (sampleId?: string) => void;
  query?: string;
  setMetricsSamples?: React.Dispatch<
    React.SetStateAction<MetricsSamplesResults<Field>['data'] | undefined>
  >;
  sortKey?: string;
}

export function SearchableMetricSamplesTable({
  mri,
  query: primaryQuery,
  ...props
}: MetricsSamplesTableProps) {
  const [secondaryQuery, setSecondaryQuery] = useState('');
  const handleSearch = useCallback((value: any) => {
    setSecondaryQuery(value);
  }, []);

  const query = useMemo(() => {
    if (!secondaryQuery) {
      return primaryQuery;
    }

    return `${primaryQuery} ${secondaryQuery}`;
  }, [primaryQuery, secondaryQuery]);

  return (
    <Fragment>
      <MetricsSamplesSearchBar
        mri={mri}
        query={secondaryQuery}
        handleSearch={handleSearch}
      />
      <MetricSamplesTable mri={mri} query={query} {...props} />
    </Fragment>
  );
}

interface MetricsSamplesSearchBarProps {
  // @ts-expect-error TS(7051): Parameter has a name but no type. Did you mean 'ar... Remove this comment to see the full error message
  handleSearch: (string) => void;
  query: string;
  mri?: MRI;
}

export function MetricsSamplesSearchBar({
  handleSearch,
  mri,
  query,
}: MetricsSamplesSearchBarProps) {
  const parsedMRI = useMemo(() => {
    if (!defined(mri)) {
      return null;
    }
    return parseMRI(mri);
  }, [mri]);

  const enabled = useMemo(() => {
    return parsedMRI?.useCase === 'transactions' || parsedMRI?.useCase === 'spans';
  }, [parsedMRI]);

  return (
    <SearchBar
      disabled={!enabled}
      query={query}
      onSearch={handleSearch}
      placeholder={
        enabled ? t('Filter by span tags') : t('Search not available for this metric')
      }
    />
  );
}

export function MetricSamplesTable({
  focusArea,
  mri,
  onRowHover,
  aggregation,
  condition,
  query,
  setMetricsSamples,
  sortKey = 'sort',
  hasPerformance = true,
}: MetricsSamplesTableProps) {
  const location = useLocation();
  const {resolveVirtualMRI} = useVirtualMetricsContext();

  let resolvedMRI = mri;
  let resolvedAggregation = aggregation;
  if (mri && isVirtualMetric({mri}) && condition && aggregation) {
    const resolved = resolveVirtualMRI(mri, condition, aggregation);
    resolvedMRI = resolved.mri;
    resolvedAggregation = resolved.aggregation;
  }

  const enabled = defined(mri);

  const parsedMRI = useMemo(() => {
    if (!defined(mri)) {
      return null;
    }
    return parseMRI(mri);
  }, [mri]);

  const datetime = useMemo(() => {
    if (!defined(focusArea) || !defined(focusArea.start) || !defined(focusArea.end)) {
      return undefined;
    }
    return {
      start: focusArea.start,
      end: focusArea.end,
    } as PageFilters['datetime'];
  }, [focusArea]);

  const currentSort = useMemo(() => {
    const value = decodeScalar(location.query[sortKey], '');
    if (!value) {
      return undefined;
    }
    const direction: 'asc' | 'desc' = value[0] === '-' ? 'desc' : 'asc';
    const key = direction === 'asc' ? value : value.substring(1);

    if (ALWAYS_SORTABLE_COLUMNS.has(key as ResultField)) {
      return {key, direction};
    }

    if (OPTIONALLY_SORTABLE_COLUMNS.has(key as ResultField)) {
      const column = getColumnForMRI(mri);
      if (column.key === key) {
        return {key, direction};
      }
    }

    return undefined;
  }, [location.query, mri, sortKey]);

  const sortQuery = useMemo(() => {
    if (!defined(currentSort)) {
      return undefined;
    }

    const direction = currentSort.direction === 'asc' ? '' : '-';
    return `${direction}${currentSort.key}`;
  }, [currentSort]);

  const result = useMetricsSamples({
    fields,
    datetime,
    max: focusArea?.max,
    min: focusArea?.min,
    mri: resolvedMRI,
    aggregation: resolvedAggregation,
    query,
    referrer: 'api.organization.metrics-samples',
    enabled,
    sort: sortQuery,
    limit: 20,
  });

  // propagate the metrics samples up as needed
  useEffect(() => {
    setMetricsSamples?.(result.data?.data ?? []);
  }, [result?.data?.data, setMetricsSamples]);

  const supportedMRI = useMemo(() => {
    const responseJSON = result.error?.responseJSON;
    if (typeof responseJSON?.detail !== 'string') {
      return true;
    }

    return !responseJSON?.detail?.startsWith('Unsupported MRI: ');
  }, [result]);

  const emptyMessage = useMemo(() => {
    if (!hasPerformance) {
      return (
        <PerformanceEmptyState withIcon={false}>
          <p>{t('You need to set up tracing to collect samples.')}</p>
          <LinkButton
            priority="primary"
            external
            href="https://docs.sentry.io/performance-monitoring/getting-started"
          >
            {t('Set Up Now')}
          </LinkButton>
        </PerformanceEmptyState>
      );
    }

    if (!defined(mri)) {
      return (
        <EmptyStateWarning>
          <p>{t('Choose a metric to display samples')}</p>
        </EmptyStateWarning>
      );
    }

    return null;
  }, [mri, hasPerformance]);

  const _renderHeadCell = useMemo(() => {
    const generateSortLink = (key: string) => () => {
      if (!SORTABLE_COLUMNS.has(key as ResultField)) {
        return undefined;
      }

      let sort: string | undefined = undefined;
      if (defined(currentSort) && currentSort.key === key) {
        if (currentSort.direction === 'desc') {
          sort = key;
        }
      } else {
        sort = `-${key}`;
      }

      return {
        ...location,
        query: {
          ...location.query,
          sort,
        },
      };
    };
    return renderHeadCell(currentSort, generateSortLink);
  }, [currentSort, location]);

  const _renderBodyCell = useMemo(
    () => renderBodyCell(aggregation, parsedMRI?.unit),
    [aggregation, parsedMRI?.unit]
  );

  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = useMemo(
    () =>
      debounce((event: React.MouseEvent) => {
        const wrapper = wrapperRef.current;
        const target = event.target;

        if (!wrapper || !(target instanceof Element)) {
          onRowHover?.(undefined);
          return;
        }

        const tableRow = (target as Element).closest('tbody >tr');
        if (!tableRow) {
          onRowHover?.(undefined);
          return;
        }

        const rows = Array.from(wrapper.querySelectorAll('tbody > tr'));
        const rowIndex = rows.indexOf(tableRow);
        const rowId = result.data?.data?.[rowIndex]?.id;

        if (!rowId) {
          onRowHover?.(undefined);
          return;
        }

        onRowHover?.(rowId);
      }, 10),
    [onRowHover, result.data?.data]
  );

  return (
    <div
      ref={wrapperRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onRowHover?.(undefined)}
    >
      <GridEditable
        isLoading={enabled && result.isPending}
        error={enabled && result.isError && supportedMRI}
        data={result.data?.data ?? []}
        columnOrder={getColumnOrder(mri)}
        columnSortBy={[]}
        grid={{
          renderBodyCell: _renderBodyCell,
          renderHeadCell: _renderHeadCell,
        }}
        emptyMessage={emptyMessage}
        minimumColWidth={60}
      />
    </div>
  );
}

function getColumnForMRI(mri?: MRI): GridColumnOrder<ResultField> {
  const parsedMRI = parseMRI(mri);
  return parsedMRI?.useCase === 'spans' && parsedMRI?.name === 'span.self_time'
    ? {key: 'span.self_time', width: COL_WIDTH_UNDEFINED, name: 'Self Time'}
    : parsedMRI?.useCase === 'transactions' && parsedMRI?.name === 'transaction.duration'
      ? {key: 'span.duration', width: COL_WIDTH_UNDEFINED, name: 'Duration'}
      : {
          key: 'summary',
          width: COL_WIDTH_UNDEFINED,
          name: mri ? formatMRI(mri) : 'Summary',
        };
}

function getColumnOrder(mri?: MRI): GridColumnOrder<ResultField>[] {
  const orders: (GridColumnOrder<ResultField> | undefined)[] = [
    {key: 'id', width: COL_WIDTH_UNDEFINED, name: 'Span ID'},
    {key: 'span.description', width: COL_WIDTH_UNDEFINED, name: 'Description'},
    {key: 'span.op', width: COL_WIDTH_UNDEFINED, name: 'Operation'},
    getColumnForMRI(mri),
    {key: 'timestamp', width: COL_WIDTH_UNDEFINED, name: 'Timestamp'},
    {key: 'profile.id', width: COL_WIDTH_UNDEFINED, name: 'Profile'},
  ];

  return orders.filter(
    (
      order: GridColumnOrder<ResultField> | undefined
    ): order is GridColumnOrder<ResultField> => !!order
  );
}

const RIGHT_ALIGNED_COLUMNS = new Set<ResultField>([
  'span.duration',
  'span.self_time',
  'summary',
]);

const ALWAYS_SORTABLE_COLUMNS = new Set<ResultField>(['timestamp']);

const OPTIONALLY_SORTABLE_COLUMNS = new Set<ResultField>([
  'summary',
  'span.self_time',
  'span.duration',
]);

const SORTABLE_COLUMNS: Set<ResultField> = new Set([
  ...ALWAYS_SORTABLE_COLUMNS,
  ...OPTIONALLY_SORTABLE_COLUMNS,
]);

function renderHeadCell(
  currentSort: {direction: 'asc' | 'desc'; key: string} | undefined,
  generateSortLink: (key: any) => () => LocationDescriptorObject | undefined
) {
  return function (col: GridColumnOrder<ResultField>) {
    return (
      <SortLink
        align={RIGHT_ALIGNED_COLUMNS.has(col.key) ? 'right' : 'left'}
        canSort={SORTABLE_COLUMNS.has(col.key)}
        direction={col.key === currentSort?.key ? currentSort?.direction : undefined}
        generateSortLink={generateSortLink(col.key)}
        title={col.name}
      />
    );
  };
}

function renderBodyCell(aggregation?: MetricAggregation, unit?: string) {
  return function (
    col: GridColumnOrder<ResultField>,
    dataRow: MetricsSamplesResults<SelectedField>['data'][number]
  ) {
    if (col.key === 'id') {
      return (
        <SpanId
          project={dataRow.project}
          trace={dataRow.trace}
          timestamp={dataRow.timestamp}
          selfTime={dataRow['span.self_time']}
          duration={dataRow['span.duration']}
          spanId={dataRow.id}
          transaction={dataRow.transaction}
          transactionId={dataRow['transaction.id']}
        />
      );
    }

    if (col.key === 'span.description') {
      return (
        <SpanDescription
          description={dataRow['span.description']}
          project={dataRow.project}
        />
      );
    }

    if (col.key === 'span.self_time' || col.key === 'span.duration') {
      return <DurationRenderer duration={dataRow[col.key]} />;
    }

    if (col.key === 'summary') {
      return (
        <SummaryRenderer
          summary={dataRow.summary}
          aggregation={aggregation}
          unit={unit}
        />
      );
    }

    if (col.key === 'timestamp') {
      return <TimestampRenderer timestamp={dataRow.timestamp} />;
    }

    if (col.key === 'trace') {
      return (
        <TraceId
          traceId={dataRow.trace}
          timestamp={dataRow.timestamp}
          eventId={dataRow.id}
        />
      );
    }

    if (col.key === 'profile.id') {
      return (
        <ProfileId projectSlug={dataRow.project} profileId={dataRow['profile.id']} />
      );
    }

    return <Container>{dataRow[col.key]}</Container>;
  };
}

function ProjectRenderer({projectSlug}: {projectSlug: string}) {
  const organization = useOrganization();

  return (
    <Flex>
      <Projects orgId={organization.slug} slugs={[projectSlug]}>
        {({projects}) => {
          const project = projects.find(p => p.slug === projectSlug);
          return (
            <ProjectBadge
              project={project ? project : {slug: projectSlug}}
              avatarSize={16}
              hideName
            />
          );
        }}
      </Projects>
    </Flex>
  );
}

function SpanId({
  duration,
  project,
  selfTime,
  spanId,
  transaction,
  transactionId,
  trace,
  timestamp,
  selfTimeColor = '#694D99',
  durationColor = 'gray100',
}: {
  duration: number;
  project: string;
  selfTime: number;
  spanId: string;
  timestamp: DateString;
  trace: string;
  transaction: string;
  transactionId: string | null;
  durationColor?: string;
  selfTimeColor?: string;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects({slugs: [project]});
  const transactionDetailsTarget = defined(transactionId)
    ? generateLinkToEventInTraceView({
        eventId: transactionId,
        projectSlug: project,
        traceSlug: trace,
        timestamp: timestamp?.toString() ?? '',
        location,
        organization,
        spanId,
        transactionName: transaction,
        source: TraceViewSources.METRICS,
      })
    : undefined;

  const colorStops = useMemo(() => {
    const percentage = selfTime / duration;
    return [
      {color: selfTimeColor, percent: percentage},
      {color: durationColor, percent: 1 - percentage},
    ];
  }, [duration, selfTime, durationColor, selfTimeColor]);

  const transactionSummaryTarget = transactionSummaryRouteWithQuery({
    orgSlug: organization.slug,
    transaction,
    query: {
      ...location.query,
      query: undefined,
    },
    projectID: String(projects[0]?.id ?? ''),
  });

  let contents = spanId ? (
    <Fragment>{getShortEventId(spanId)}</Fragment>
  ) : (
    <EmptyValueContainer>{t('(no value)')}</EmptyValueContainer>
  );
  if (defined(transactionDetailsTarget)) {
    contents = <Link to={transactionDetailsTarget}>{getShortEventId(spanId)}</Link>;
  }

  return (
    <Container>
      <StyledHovercard
        header={
          <Flex justify="space-between" align="center">
            {t('Span ID')}
            <SpanIdWrapper>
              {getShortEventId(spanId)}
              <CopyToClipboardButton borderless iconSize="xs" size="zero" text={spanId} />
            </SpanIdWrapper>
          </Flex>
        }
        body={
          <Flex gap={space(0.75)} column>
            <SectionTitle>{t('Duration')}</SectionTitle>
            <ColorBar colorStops={colorStops} />
            <Flex justify="space-between" align="center">
              <Flex justify="space-between" align="center" gap={space(0.5)}>
                <LegendDot color={selfTimeColor} />
                {t('Self Time: ')}
                <PerformanceDuration milliseconds={selfTime} abbreviation />
              </Flex>
              <Flex justify="space-between" align="center" gap={space(0.5)}>
                <LegendDot color={durationColor} />
                {t('Duration: ')}
                <PerformanceDuration milliseconds={duration} abbreviation />
              </Flex>
            </Flex>
            <SectionTitle>{t('Transaction')}</SectionTitle>
            <Tooltip containerDisplayMode="inline" showOnlyOnOverflow title={transaction}>
              <Link
                to={transactionSummaryTarget}
                onClick={() =>
                  trackAnalytics('ddm.sample-table-interaction', {
                    organization,
                    target: 'description',
                  })
                }
              >
                <TextOverflow>{transaction}</TextOverflow>
              </Link>
            </Tooltip>
          </Flex>
        }
        showUnderline
      >
        {contents}
      </StyledHovercard>
    </Container>
  );
}

function SpanDescription({description, project}: {description: string; project: string}) {
  if (!description) {
    return (
      <Flex gap={space(0.75)} align="center">
        <ProjectRenderer projectSlug={project} />
        <EmptyValueContainer>{t('(none)')}</EmptyValueContainer>
      </Flex>
    );
  }

  return (
    <Flex gap={space(0.75)} align="center">
      <ProjectRenderer projectSlug={project} />
      <Container>{description}</Container>
    </Flex>
  );
}

function DurationRenderer({duration}: {duration: number}) {
  return (
    <NumberContainer>
      <PerformanceDuration milliseconds={duration} abbreviation />
    </NumberContainer>
  );
}

function SummaryRenderer({
  summary,
  aggregation,
  unit,
}: {
  summary: Summary;
  aggregation?: MetricAggregation;
  unit?: string;
}) {
  const value = getSummaryValueForAggregation(summary, aggregation);

  // if the op is `count`, then the unit does not apply
  unit = aggregation === 'count' ? '' : unit;

  return (
    <NumberContainer>{formatMetricUsingUnit(value ?? null, unit ?? '')}</NumberContainer>
  );
}

function TimestampRenderer({timestamp}: {timestamp: DateString}) {
  const location = useLocation();

  return (
    <FieldDateTime
      date={timestamp}
      year
      seconds
      timeZone
      utc={decodeScalar(location?.query?.utc) === 'true'}
    />
  );
}

function TraceId({
  traceId,
  timestamp,
  eventId,
}: {
  traceId: string;
  eventId?: string;
  timestamp?: DateString;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const {selection} = usePageFilters();
  const stringOrNumberTimestamp =
    timestamp instanceof Date ? timestamp.toISOString() : timestamp ?? '';

  const target = getTraceDetailsUrl({
    organization,
    traceSlug: traceId,
    dateSelection: {
      start: selection.datetime.start,
      end: selection.datetime.end,
      statsPeriod: selection.datetime.period,
    },
    timestamp: stringOrNumberTimestamp,
    eventId,
    location,
    source: TraceViewSources.METRICS,
  });

  return (
    <Container>
      <Link
        to={target}
        onClick={() =>
          trackAnalytics('ddm.sample-table-interaction', {
            organization,
            target: 'trace-id',
          })
        }
      >
        {getShortEventId(traceId)}
      </Link>
    </Container>
  );
}

function ProfileId({
  profileId,
  projectSlug,
}: {
  profileId: string | null;
  projectSlug: string;
}) {
  const organization = useOrganization();

  if (!defined(profileId)) {
    return (
      <Container>
        <Button
          disabled
          size="xs"
          icon={<IconProfiling />}
          aria-label={t('Open Profile')}
        />
      </Container>
    );
  }

  const target = generateProfileFlamechartRoute({
    orgSlug: organization.slug,
    projectSlug,
    profileId,
  });

  return (
    <Container>
      <LinkButton
        to={target}
        size="xs"
        onClick={() =>
          trackAnalytics('ddm.sample-table-interaction', {
            organization,
            target: 'profile',
          })
        }
      >
        <IconProfiling size="xs" />
      </LinkButton>
    </Container>
  );
}

const SearchBar = styled(SmartSearchBar)`
  margin-bottom: ${space(2)};
`;

const StyledHovercard = styled(Hovercard)`
  width: 350px;
`;

const SpanIdWrapper = styled('span')`
  font-weight: ${p => p.theme.fontWeightNormal};
`;

const SectionTitle = styled('h6')`
  color: ${p => p.theme.subText};
  margin-bottom: 0;
`;

const TextOverflow = styled('span')`
  ${p => p.theme.overflowEllipsis};
`;

const LegendDot = styled('div')<{color: string}>`
  display: block;
  width: ${space(1)};
  height: ${space(1)};
  border-radius: 100%;
  background-color: ${p => p.theme[p.color] ?? p.color};
`;

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;

const PerformanceEmptyState = styled(EmptyStateWarning)`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;
