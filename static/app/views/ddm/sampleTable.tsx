import {useCallback} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
} from 'sentry/components/gridEditable';
import {Tooltip} from 'sentry/components/tooltip';
import {IconPlay, IconProfiling} from 'sentry/icons';
import {t} from 'sentry/locale';
import {MRI} from 'sentry/types';
import {getDuration} from 'sentry/utils/formatters';
import {useMetricsSpans} from 'sentry/utils/metrics/useMetricsCodeLocations';
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
  {key: 'spanId', width: COL_WIDTH_UNDEFINED, name: 'Event ID'},
  {key: 'duration', width: COL_WIDTH_UNDEFINED, name: 'Duration'},
  {key: 'traceId', width: COL_WIDTH_UNDEFINED, name: 'Trace ID'},
  {key: 'profileId', width: COL_WIDTH_UNDEFINED, name: 'Profile'},
  {key: 'replayId', width: COL_WIDTH_UNDEFINED, name: 'Replay'},
];

export function SampleTable({mri, ...metricMetaOptions}: SamplesTableProps) {
  const location = useLocation();
  const organization = useOrganization();
  const {projects} = useProjects();

  const {data, isFetching} = useMetricsSpans(mri, metricMetaOptions);

  const getProjectSlug = useCallback(
    (projectId: number) => {
      return projects.find(p => parseInt(p.id, 10) === projectId)?.slug;
    },
    [projects]
  );

  const rows = data?.metrics
    .map(m => m.metricSpans)
    .flat()
    .filter(Boolean) as MetricSpan[];

  function renderHeadCell(col: Column) {
    if (col.key === 'profileId' || col.key === 'replayId') {
      return <AlignCenter>{col.name}</AlignCenter>;
    }
    return <span>{col.name}</span>;
  }

  function renderBodyCell(col: Column, row: MetricSpan) {
    const {key} = col;
    if (!row[key]) {
      return <AlignCenter>{'\u2014'}</AlignCenter>;
    }
    if (key === 'spanId') {
      return (
        <span>
          <Link
            to={normalizeUrl(
              `/organizations/${organization.slug}/performance/${getProjectSlug(
                row.projectId
              )}:${row.transactionId}/#span-${row.spanId}`
            )}
          >
            {row.spanId.slice(0, 8)}
          </Link>
        </span>
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
                `/organizations/${organization.slug}/profiling/profile/${getProjectSlug(
                  row.projectId
                )}/${row.profileId}/flamegraph/`
              )}
              size="xs"
            >
              <IconProfiling size="xs" />
            </LinkButton>
          </Tooltip>
        </AlignCenter>
      );
    }
    if (key === 'replayId') {
      return (
        <AlignCenter>
          <Tooltip title={t('View Replay')}>
            <LinkButton
              to={normalizeUrl(
                `/organizations/${organization.slug}/replays/${row.replayId}/`
              )}
              size="xs"
            >
              <IconPlay size="xs" />
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
