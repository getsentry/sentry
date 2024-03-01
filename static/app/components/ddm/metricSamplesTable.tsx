import {useMemo} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptorObject} from 'history';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  type GridColumnOrder,
} from 'sentry/components/gridEditable';
import SortLink from 'sentry/components/gridEditable/sortLink';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {t} from 'sentry/locale';
import type {DateString, MRI, PageFilters, ParsedMRI} from 'sentry/types';
import {defined} from 'sentry/utils';
import {Container, FieldDateTime, NumberContainer} from 'sentry/utils/discover/styles';
import {getShortEventId} from 'sentry/utils/events';
import {formatMetricUsingUnit} from 'sentry/utils/metrics/formatters';
import {parseMRI} from 'sentry/utils/metrics/mri';
import {
  type Field,
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
import type {SelectionRange} from 'sentry/views/ddm/chart/types';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';

const fields: Field[] = [
  'project',
  'id',
  'span.op',
  'span.description',
  'span.duration',
  'span.self_time',
  'timestamp',
  'trace',
  'transaction.id',
  'profile_id',
];

interface MetricSamplesTableProps {
  focusArea?: SelectionRange;
  mri?: MRI;
  op?: string;
  query?: string;
  sortKey?: string;
}

export function MetricSamplesTable({
  focusArea,
  mri,
  op,
  query,
  sortKey = 'sort',
}: MetricSamplesTableProps) {
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
    return {key, direction};
  }, [location.query, sortKey]);

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
    query,
    referrer: 'foo',
    enabled,
    sort: sortQuery,
    limit: 10,
  });

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

  const _renderBodyCell = useMemo(
    () => renderBodyCell(op, parsedMRI?.unit),
    [op, parsedMRI?.unit]
  );

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

  return (
    <GridEditable
      isLoading={enabled && result.isLoading}
      error={enabled && result.isError && supportedMRI}
      data={result.data?.data ?? []}
      columnOrder={getColumnOrder(parsedMRI)}
      columnSortBy={[]}
      grid={{renderBodyCell: _renderBodyCell, renderHeadCell: _renderHeadCell}}
      location={location}
      emptyMessage={emptyMessage}
    />
  );
}

function getColumnOrder(parsedMRI?: ParsedMRI | null): GridColumnOrder<ResultField>[] {
  const orders: (GridColumnOrder<ResultField> | undefined)[] = [
    {key: 'project', width: COL_WIDTH_UNDEFINED, name: 'Project'},
    {key: 'id', width: COL_WIDTH_UNDEFINED, name: 'Span ID'},
    {key: 'span.op', width: COL_WIDTH_UNDEFINED, name: 'Op'},
    {key: 'span.description', width: COL_WIDTH_UNDEFINED, name: 'Description'},
    {key: 'span.self_time', width: COL_WIDTH_UNDEFINED, name: 'Self Time'},
    {key: 'span.duration', width: COL_WIDTH_UNDEFINED, name: 'Duration'},
    parsedMRI?.useCase === 'custom'
      ? {key: 'summary', width: COL_WIDTH_UNDEFINED, name: parsedMRI?.name ?? 'Summary'}
      : undefined,
    {key: 'timestamp', width: COL_WIDTH_UNDEFINED, name: 'Timestamp'},
    {key: 'trace', width: COL_WIDTH_UNDEFINED, name: 'Trace'},
    {key: 'profile_id', width: COL_WIDTH_UNDEFINED, name: 'Profile'},
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
const SORTABLE_COLUMNS = new Set<ResultField>(['span.duration', 'timestamp']);

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
    dataRow: MetricsSamplesResults<Field>['data'][number]
  ) {
    if (col.key === 'id') {
      return (
        <SpanId
          project={dataRow.project}
          spanId={dataRow.id}
          transactionId={dataRow['transaction.id']}
        />
      );
    }

    if (col.key === 'project') {
      return <ProjectRenderer projectSlug={dataRow.project} />;
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

    if (col.key === 'profile_id') {
      return <ProfileId projectSlug={dataRow.project} profileId={dataRow.profile_id} />;
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
            />
          );
        }}
      </Projects>
    </Container>
  );
}

function SpanId({
  project,
  spanId,
  transactionId,
}: {
  project: string;
  spanId: string;
  transactionId: string;
}) {
  const organization = useOrganization();
  const target = getTransactionDetailsUrl(
    organization.slug,
    `${project}:${transactionId}`,
    undefined,
    undefined,
    spanId
  );
  return (
    <Container>
      <Link to={target}>{getShortEventId(spanId)}</Link>
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
  const value =
    op === 'count'
      ? summary.count
      : op === 'min'
        ? summary.min
        : op === 'max'
          ? summary.max
          : op === 'sum'
            ? summary.sum
            : summary.sum / summary.count;

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
    return <EmptyValueContainer>{t('(no value)')}</EmptyValueContainer>;
  }

  const target = generateProfileFlamechartRoute({
    orgSlug: organization.slug,
    projectSlug,
    profileId,
  });

  return (
    <Container>
      <Link to={target}>{getShortEventId(profileId)}</Link>
    </Container>
  );
}

const EmptyValueContainer = styled('span')`
  color: ${p => p.theme.gray300};
`;
