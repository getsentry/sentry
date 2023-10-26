import {Fragment, useMemo} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import {Tag} from 'sentry/types';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {getDuration} from 'sentry/utils/formatters';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useRoutes} from 'sentry/utils/useRoutes';
import {PerformanceBadge} from 'sentry/views/performance/browser/webVitals/components/performanceBadge';
import {WebVitalTagsDetailHeader} from 'sentry/views/performance/browser/webVitals/components/webVitalDescription';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {TransactionSampleRowWithScore} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useProjectWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsQuery';
import {useTransactionSamplesWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useTransactionSamplesWebVitalsQuery';
import {generateReplayLink} from 'sentry/views/performance/transactionSummary/utils';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';

type Column = GridColumnHeader;

const columnOrder: GridColumnOrder[] = [
  {key: 'id', width: COL_WIDTH_UNDEFINED, name: 'Event ID'},
  {key: 'browser', width: COL_WIDTH_UNDEFINED, name: 'Browser'},
  {key: 'replayId', width: COL_WIDTH_UNDEFINED, name: 'Replay'},
  {key: 'profile.id', width: COL_WIDTH_UNDEFINED, name: 'Profile'},
  {key: 'transaction.duration', width: COL_WIDTH_UNDEFINED, name: 'Duration'},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: 'Performance Score'},
];

const sort: GridColumnSortBy<keyof TransactionSampleRowWithScore> = {
  key: 'score',
  order: 'desc',
};

export function PageOverviewWebVitalsTagDetailPanel({
  tag,
  onClose,
}: {
  onClose: () => void;
  tag?: Tag;
}) {
  const location = useLocation();
  const {projects} = useProjects();
  const organization = useOrganization();
  const routes = useRoutes();

  const replayLinkGenerator = generateReplayLink(routes);

  const project = useMemo(
    () => projects.find(p => p.id === String(location.query.project)),
    [projects, location.query.project]
  );

  const transaction = location.query.transaction
    ? Array.isArray(location.query.transaction)
      ? location.query.transaction[0]
      : location.query.transaction
    : undefined;

  const {data: projectData, isLoading: projectDataLoading} = useProjectWebVitalsQuery({
    transaction,
    tag,
  });

  const projectScore = calculatePerformanceScore({
    lcp: projectData?.data[0]['p75(measurements.lcp)'] as number,
    fcp: projectData?.data[0]['p75(measurements.fcp)'] as number,
    cls: projectData?.data[0]['p75(measurements.cls)'] as number,
    ttfb: projectData?.data[0]['p75(measurements.ttfb)'] as number,
    fid: projectData?.data[0]['p75(measurements.fid)'] as number,
  });

  const {
    data: samplesTableData,
    isLoading: isSamplesTabledDataLoading,
    isFetching,
    refetch,
  } = useTransactionSamplesWebVitalsQuery({
    limit: 3,
    transaction: transaction ?? '',
    query: tag ? `${tag.key}:${tag.name}` : undefined,
    enabled: Boolean(tag),
  });

  const tableData: TransactionSampleRowWithScore[] = samplesTableData.sort(
    (a, b) => a.score - b.score
  );

  const renderHeadCell = (col: Column) => {
    if (col.key === 'id' || col.key === 'browser') {
      return <NoOverflow>{col.name}</NoOverflow>;
    }
    return <AlignCenter>{col.name}</AlignCenter>;
  };

  const getFormattedDuration = (value: number | null) => {
    if (value === null) {
      return null;
    }
    if (value < 1000) {
      return getDuration(value / 1000, 0, true);
    }
    return getDuration(value / 1000, 2, true);
  };

  const renderBodyCell = (col: Column, row: TransactionSampleRowWithScore) => {
    const {key} = col;
    if (key === 'score') {
      return (
        <AlignCenter>
          <PerformanceBadge score={row.score} />
        </AlignCenter>
      );
    }
    if (key === 'browser') {
      return <NoOverflow>{row[key]}</NoOverflow>;
    }
    if (key === 'id') {
      const eventSlug = generateEventSlug({...row, project: project?.slug});
      const eventTarget = getTransactionDetailsUrl(organization.slug, eventSlug);
      return (
        <NoOverflow>
          <Link to={eventTarget} onClick={onClose}>
            {getShortEventId(row.id)}
          </Link>
        </NoOverflow>
      );
    }
    if (key === 'replayId') {
      const replayTarget =
        row['transaction.duration'] !== null &&
        replayLinkGenerator(
          organization,
          {
            replayId: row.replayId,
            id: row.id,
            'transaction.duration': row['transaction.duration'],
            timestamp: row.timestamp,
          },
          undefined
        );

      return row.replayId && replayTarget ? (
        <AlignCenter>
          <Link to={replayTarget}>{getShortEventId(row.replayId)}</Link>
        </AlignCenter>
      ) : (
        <AlignCenter>{' \u2014 '}</AlignCenter>
      );
    }
    if (key === 'profile.id') {
      const eventSlug = generateEventSlug({...row, project: project?.slug});
      const eventTarget = getTransactionDetailsUrl(organization.slug, eventSlug);
      return row['profile.id'] ? (
        <AlignCenter>
          <Link to={eventTarget} onClick={onClose}>
            {row['profile.id']}
          </Link>
        </AlignCenter>
      ) : (
        <AlignCenter>{' \u2014 '}</AlignCenter>
      );
    }
    if (key === 'transaction.duration') {
      return <AlignCenter>{getFormattedDuration(row[key])}</AlignCenter>;
    }
    return <AlignCenter>{row[key]}</AlignCenter>;
  };

  return (
    <PageErrorProvider>
      <DetailPanel detailKey={tag?.key} onClose={onClose}>
        {tag && (
          <Fragment>
            <WebVitalTagsDetailHeader
              value="TBD"
              tag={tag}
              projectScore={projectScore}
              isProjectScoreCalculated={!projectDataLoading}
            />
            <GridEditable
              data={tableData}
              isLoading={isSamplesTabledDataLoading || isFetching}
              columnOrder={columnOrder}
              columnSortBy={[sort]}
              grid={{
                renderHeadCell,
                renderBodyCell,
              }}
              location={location}
            />
          </Fragment>
        )}
        <Button onClick={() => refetch()}>{t('Try Different Samples')}</Button>
        <PageErrorAlert />
      </DetailPanel>
    </PageErrorProvider>
  );
}

const NoOverflow = styled('span')`
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AlignCenter = styled('span')`
  text-align: center;
  width: 100%;
`;
