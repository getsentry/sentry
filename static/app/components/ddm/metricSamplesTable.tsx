import {Fragment, useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptorObject} from 'history';
import debounce from 'lodash/debounce';

import {Button, LinkButton} from 'sentry/components/button';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import {Hovercard} from 'sentry/components/hovercard';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {Flex} from 'sentry/components/profiling/flex';
import SmartSearchBar from 'sentry/components/smartSearchBar';
import {Tooltip} from 'sentry/components/tooltip';
import {IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DateString, MRI, PageFilters, ParsedMRI} from 'sentry/types';
import {defined} from 'sentry/utils';
import {Container, FieldDateTime, NumberContainer} from 'sentry/utils/discover/styles';
import {getShortEventId} from 'sentry/utils/events';
import {formatMetricUsingUnit} from 'sentry/utils/metrics/formatters';
import {parseMRI} from 'sentry/utils/metrics/mri';
import {
  type Field as SelectedField,
  getSummaryValueForOp,
  type MetricsSamplesResults,
  type ResultField,
  type Summary,
  useMetricsSamples,
} from 'sentry/utils/metrics/useMetricsSamples';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import Projects from 'sentry/utils/projects';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import type {SelectionRange} from 'sentry/views/ddm/chart/types';
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
  focusArea?: SelectionRange;
  mri?: MRI;
  onRowHover?: (sampleId?: string) => void;
  op?: string;
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
  const handleSearch = useCallback(value => {
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
  op,
  query,
  setMetricsSamples,
  sortKey = 'sort',
}: MetricsSamplesTableProps) {
  const location = useLocation();

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
      const column = getColumnForMRI(parsedMRI);
      if (column.key === key) {
        return {key, direction};
      }
    }

    return undefined;
  }, [location.query, parsedMRI, sortKey]);

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
    mri,
    op,
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
    if (!defined(mri)) {
      return (
        <EmptyStateWarning>
          <p>{t('Choose a metric to display samples')}</p>
        </EmptyStateWarning>
      );
    }

    return null;
  }, [mri]);

  const _renderPrependColumn = useMemo(() => {
    return renderPrependColumn();
  }, []);

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
    () => renderBodyCell(op, parsedMRI?.unit),
    [op, parsedMRI?.unit]
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
        isLoading={enabled && result.isLoading}
        error={enabled && result.isError && supportedMRI}
        data={result.data?.data ?? []}
        columnOrder={getColumnOrder(parsedMRI)}
        columnSortBy={[]}
        grid={{
          prependColumnWidths,
          renderPrependColumns: _renderPrependColumn,
          renderBodyCell: _renderBodyCell,
          renderHeadCell: _renderHeadCell,
        }}
        location={location}
        emptyMessage={emptyMessage}
        minimumColWidth={60}
      />
    </div>
  );
}

function getColumnForMRI(parsedMRI?: ParsedMRI | null): GridColumnOrder<ResultField> {
  return parsedMRI?.useCase === 'spans' && parsedMRI?.name === 'span.self_time'
    ? {key: 'span.self_time', width: COL_WIDTH_UNDEFINED, name: 'Self Time'}
    : parsedMRI?.useCase === 'transactions' && parsedMRI?.name === 'transaction.duration'
      ? {key: 'span.duration', width: COL_WIDTH_UNDEFINED, name: 'Duration'}
      : {key: 'summary', width: COL_WIDTH_UNDEFINED, name: parsedMRI?.name ?? 'Summary'};
}

function getColumnOrder(parsedMRI?: ParsedMRI | null): GridColumnOrder<ResultField>[] {
  const orders: (GridColumnOrder<ResultField> | undefined)[] = [
    {key: 'span.description', width: COL_WIDTH_UNDEFINED, name: 'Description'},
    {key: 'span.op', width: COL_WIDTH_UNDEFINED, name: 'Operation'},
    getColumnForMRI(parsedMRI),
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

const prependColumnWidths = ['40px'];

function renderPrependColumn() {
  return function (
    isHeader: boolean,
    dataRow?: MetricsSamplesResults<SelectedField>['data'][number],
    _rowIndex?: number
  ) {
    if (isHeader) {
      return [null];
    }
    return [dataRow ? <ProjectRenderer projectSlug={dataRow.project} /> : null];
  };
}

function renderHeadCell(
  currentSort: {direction: 'asc' | 'desc'; key: string} | undefined,
  generateSortLink: (key) => () => LocationDescriptorObject | undefined
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

function renderBodyCell(op?: string, unit?: string) {
  return function (
    col: GridColumnOrder<ResultField>,
    dataRow: MetricsSamplesResults<SelectedField>['data'][number]
  ) {
    if (col.key === 'span.description') {
      return (
        <SpanDescription
          description={dataRow['span.description']}
          project={dataRow.project}
          selfTime={dataRow['span.self_time']}
          duration={dataRow['span.duration']}
          spanId={dataRow.id}
          transaction={dataRow.transaction}
          transactionId={dataRow['transaction.id']}
        />
      );
    }

    if (col.key === 'span.self_time' || col.key === 'span.duration') {
      return <DurationRenderer duration={dataRow[col.key]} />;
    }

    if (col.key === 'summary') {
      return <SummaryRenderer summary={dataRow.summary} op={op} unit={unit} />;
    }

    if (col.key === 'timestamp') {
      return <TimestampRenderer timestamp={dataRow.timestamp} />;
    }

    if (col.key === 'trace') {
      return <TraceId traceId={dataRow.trace} />;
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
    <Container>
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
    </Container>
  );
}

function SpanDescription({
  description,
  duration,
  project,
  selfTime,
  spanId,
  transaction,
  transactionId,
  selfTimeColor = '#694D99',
  durationColor = 'gray100',
}: {
  description: string;
  duration: number;
  project: string;
  selfTime: number;
  spanId: string;
  transaction: string;
  transactionId: string;
  durationColor?: string;
  selfTimeColor?: string;
}) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects({slugs: [project]});
  const transactionDetailsTarget = getTransactionDetailsUrl(
    organization.slug,
    `${project}:${transactionId}`,
    undefined,
    undefined,
    spanId
  );

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
              <Link to={transactionSummaryTarget}>
                <TextOverflow>{transaction}</TextOverflow>
              </Link>
            </Tooltip>
          </Flex>
        }
        showUnderline
      >
        <Link to={transactionDetailsTarget}>{description}</Link>
      </StyledHovercard>
    </Container>
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
  op,
  unit,
}: {
  summary: Summary;
  op?: string;
  unit?: string;
}) {
  const value = getSummaryValueForOp(summary, op);

  // if the op is `count`, then the unit does not apply
  unit = op === 'count' ? '' : unit;

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

function TraceId({traceId}: {traceId: string}) {
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const target = getTraceDetailsUrl(
    organization,
    traceId,
    {
      start: selection.datetime.start,
      end: selection.datetime.end,
      statsPeriod: selection.datetime.period,
    },
    {}
  );
  return (
    <Container>
      <Link to={target}>{getShortEventId(traceId)}</Link>
    </Container>
  );
}

function ProfileId({projectSlug, profileId}: {projectSlug: string; profileId?: string}) {
  const organization = useOrganization();

  if (!defined(profileId)) {
    return (
      <Container>
        <Button href={undefined} disabled size="xs">
          <IconProfiling size="xs" />
        </Button>
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
      <LinkButton to={target} size="xs">
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
  font-weight: 400;
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
