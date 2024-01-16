import {Link} from 'react-router';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';
import * as qs from 'query-string';

import {LinkButton} from 'sentry/components/button';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow, IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MRI} from 'sentry/types';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {getDuration} from 'sentry/utils/formatters';
import {useMetricsSpans} from 'sentry/utils/metrics/useMetricsCodeLocations';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {MetricRange, MetricSpan} from '../../utils/metrics/index';

export type SamplesTableProps = MetricRange & {
  mri?: MRI;
  query?: string;
};

type Column = GridColumnHeader<keyof MetricSpan>;

const columnOrder: GridColumnOrder<keyof MetricSpan>[] = [
  {key: 'transactionId', width: COL_WIDTH_UNDEFINED, name: 'Event ID'},
  {key: 'segmentName', width: COL_WIDTH_UNDEFINED, name: 'Transaction'},
  {key: 'spansNumber', width: COL_WIDTH_UNDEFINED, name: 'Number of Spans'},
  {key: 'duration', width: COL_WIDTH_UNDEFINED, name: 'Duration'},
  {key: 'traceId', width: COL_WIDTH_UNDEFINED, name: 'Trace ID'},
  {key: 'profileId', width: COL_WIDTH_UNDEFINED, name: 'Profile'},
];

export function SampleTable({mri, ...metricMetaOptions}: SamplesTableProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();

  const {data, isFetching} = useMetricsSpans(mri, metricMetaOptions);

  const rows = data?.metrics
    .map(m => m.metricSpans)
    .flat()
    .filter(Boolean)
    // We only want to show the first 10 transactions
    .slice(0, 10) as MetricSpan[];

  function renderHeadCell(col: Column) {
    if (col.key === 'profileId' || col.key === 'replayId') {
      return <AlignCenter>{col.name}</AlignCenter>;
    }
    if (col.key === 'duration') {
      return (
        <DurationHeadCell>
          {col.name}
          <IconArrow size="xs" direction="down" />
        </DurationHeadCell>
      );
    }
    return <span>{col.name}</span>;
  }

  function renderBodyCell(col: Column, row: MetricSpan) {
    const {key} = col;
    if (!row[key]) {
      return <AlignCenter>{'\u2014'}</AlignCenter>;
    }
    const project = projects.find(p => parseInt(p.id, 10) === row.projectId);
    const eventSlug = generateEventSlug({
      id: row.transactionId,
      project: project?.slug,
    });

    if (key === 'transactionId') {
      return (
        <span>
          <Link
            to={getTransactionDetailsUrl(
              organization.slug,
              eventSlug,
              undefined,
              {referrer: 'metrics'},
              row.spanId
            )}
            target="_blank"
          >
            {row.transactionId.slice(0, 8)}
          </Link>
        </span>
      );
    }
    if (key === 'segmentName') {
      return (
        <TransactionNameWrapper>
          <Tooltip title={project?.slug}>
            <StyledPlatformIcon platform={project?.platform || 'default'} />
          </Tooltip>
          <Link
            to={normalizeUrl(
              `/organizations/${organization.slug}/performance/summary/?${qs.stringify({
                ...location.query,
                project: project?.id,
                transaction: row.segmentName,
                referrer: 'metrics',
              })}`
            )}
          >
            {row.segmentName}
          </Link>
        </TransactionNameWrapper>
      );
    }
    if (key === 'duration') {
      // We get duration in miliseconds, but getDuration expects seconds
      return <span>{getDuration(row.duration / 1000, 2, true)}</span>;
    }
    if (key === 'traceId') {
      return (
        <span>
          <Link
            to={normalizeUrl(
              `/organizations/${organization.slug}/performance/trace/${row.traceId}/`
            )}
          >
            {row.traceId.slice(0, 8)}
          </Link>
        </span>
      );
    }
    if (key === 'profileId') {
      return (
        <AlignCenter>
          <Tooltip title={t('View Profile')}>
            <LinkButton
              to={normalizeUrl(
                `/organizations/${organization.slug}/profiling/profile/${project?.slug}/${row.profileId}/flamegraph/`
              )}
              size="xs"
            >
              <IconProfiling size="xs" />
            </LinkButton>
          </Tooltip>
        </AlignCenter>
      );
    }
    return <span>{row[col.key]}</span>;
  }

  return (
    <GridEditable
      isLoading={isFetching}
      columnOrder={columnOrder}
      columnSortBy={[]}
      data={rows}
      grid={{
        renderHeadCell,
        renderBodyCell,
      }}
      emptyMessage={mri ? t('No samples found') : t('Choose a metric to display data.')}
      location={location}
    />
  );
}

const AlignCenter = styled('span')`
  display: block;
  margin: auto;
  text-align: center;
  width: 100%;
`;

const TransactionNameWrapper = styled('span')`
  display: inline-block;
`;

const DurationHeadCell = styled('span')`
  display: flex;
  gap: ${space(0.25)};
`;

const StyledPlatformIcon = styled(PlatformIcon)`
  margin-right: ${space(1)};
  height: ${space(3)};
`;
