import {useMemo} from 'react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import PerformanceDuration from 'sentry/components/performanceDuration';
import {t, tct} from 'sentry/locale';
import type {MRI} from 'sentry/types';
import {defined} from 'sentry/utils';
import {Container, FieldDateTime} from 'sentry/utils/discover/styles';
import {getShortEventId} from 'sentry/utils/events';
import {formatPercentage} from 'sentry/utils/formatters';
import {isSupportedMRI, useMetricsSamples} from 'sentry/utils/metrics/useMetricsSamples';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import Projects from 'sentry/utils/projects';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getTraceDetailsUrl} from 'sentry/views/performance/traceDetails/utils';
import ColorBar from 'sentry/views/performance/vitalDetail/colorBar';

interface MetricSamplesTableProps {
  mri?: MRI;
  query?: string;
}

export function MetricSamplesTable({mri, query}: MetricSamplesTableProps) {
  const location = useLocation();

  const emptyMessage = useMemo(() => {
    if (defined(mri)) {
      return null;
    }

    return (
      <EmptyStateWarning>
        <p>{t('Choose a metric to display samples')}</p>
      </EmptyStateWarning>
    );
  }, [mri]);

  const enabled = defined(mri) && isSupportedMRI(mri);

  const result = useMetricsSamples({
    fields: [
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
    ],
    mri,
    query,
    referrer: 'foo',
    enabled,
    limit: 10,
  });

  return (
    <GridEditable
      isLoading={enabled && result.isLoading}
      error={enabled && result.isError}
      data={result.data?.data ?? []}
      columnOrder={COLUMN_ORDER}
      columnSortBy={[]}
      grid={{renderBodyCell}}
      location={location}
      emptyMessage={emptyMessage}
    />
  );
}

const COLUMN_ORDER = [
  {key: 'project', width: COL_WIDTH_UNDEFINED, name: 'Project'},
  {key: 'id', width: COL_WIDTH_UNDEFINED, name: 'Span ID'},
  {key: 'span.op', width: COL_WIDTH_UNDEFINED, name: 'Span Op'},
  {key: 'span.description', width: COL_WIDTH_UNDEFINED, name: 'Span Description'},
  {key: 'span.self_time', width: COL_WIDTH_UNDEFINED, name: 'Span Self Time'},
  {key: 'timestamp', width: COL_WIDTH_UNDEFINED, name: 'Timestamp'},
  {key: 'trace', width: COL_WIDTH_UNDEFINED, name: 'Trace'},
  {key: 'profile_id', width: COL_WIDTH_UNDEFINED, name: 'Profile'},
];

function renderBodyCell(col, dataRow) {
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

  if (col.key === 'span.self_time') {
    return (
      <SpanSelfTimeRenderer
        selfTime={dataRow['span.self_time']}
        duration={dataRow['span.duration']}
      />
    );
  }

  if (col.key === 'timestamp') {
    return <TimestampRenderer timestamp={dataRow.timestamp} />;
  }

  if (col.key === 'trace') {
    return <TraceId traceId={dataRow.trace} />;
  }

  if (col.key === 'profile_id') {
    return (
      <ProfileId
        projectSlug={dataRow.project}
        profileId={dataRow.profile_id?.replace('-', '')}
      />
    );
  }

  return <Container>{dataRow[col.key]}</Container>;
}

function ProjectRenderer({projectSlug}) {
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

function SpanId({project, spanId, transactionId}) {
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

function SpanSelfTimeRenderer({selfTime, duration}) {
  // duration is stored as an UInt32 while self time is stored
  // as a Float64. So in cases where duration should equal self time,
  // it can be truncated.
  //
  // When this happens, we just take the self time as the duration.
  const spanDuration = Math.max(selfTime, duration);
  const percentage = selfTime / spanDuration;

  const colorStops = useMemo(() => {
    return [
      {color: '#694D99', percent: percentage},
      {color: 'gray100', percent: 1 - percentage},
    ];
  }, [percentage]);

  return (
    <Container>
      {tct('[selfTime] ([percentage] of duration)', {
        selfTime: <PerformanceDuration milliseconds={selfTime} abbreviation />,
        percentage: formatPercentage(percentage),
      })}
      <ColorBar colorStops={colorStops} />
    </Container>
  );
}

function TimestampRenderer({timestamp}) {
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

function TraceId({traceId}) {
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

function ProfileId({projectSlug, profileId}) {
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
