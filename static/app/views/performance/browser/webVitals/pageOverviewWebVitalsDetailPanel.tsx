import {useMemo} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';

import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
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
import {WebVitalDetailHeader} from 'sentry/views/performance/browser/webVitals/components/webVitalDescription';
import {
  calculatePerformanceScore,
  PERFORMANCE_SCORE_MEDIANS,
  PERFORMANCE_SCORE_P90S,
} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {
  TransactionSampleRowWithScore,
  WebVitals,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useProjectWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsQuery';
import {useTransactionSamplesWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useTransactionSamplesWebVitalsQuery';
import {generateReplayLink} from 'sentry/views/performance/transactionSummary/utils';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';

type Column = GridColumnHeader;

const columnOrder: GridColumnOrder[] = [
  {key: 'id', width: COL_WIDTH_UNDEFINED, name: 'Event ID'},
  {key: 'replayId', width: COL_WIDTH_UNDEFINED, name: 'Replay'},
  {key: 'profile.id', width: COL_WIDTH_UNDEFINED, name: 'Profile'},
  {key: 'webVital', width: COL_WIDTH_UNDEFINED, name: 'Web Vital'},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: 'Score'},
];

const sort: GridColumnSortBy<keyof TransactionSampleRowWithScore> = {
  key: 'score',
  order: 'desc',
};

export function PageOverviewWebVitalsDetailPanel({
  webVital,
  onClose,
}: {
  onClose: () => void;
  webVital: WebVitals | null;
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

  const {data: projectData} = useProjectWebVitalsQuery({transaction});

  const projectScore = calculatePerformanceScore({
    lcp: projectData?.data[0]['p75(measurements.lcp)'] as number,
    fcp: projectData?.data[0]['p75(measurements.fcp)'] as number,
    cls: projectData?.data[0]['p75(measurements.cls)'] as number,
    ttfb: projectData?.data[0]['p75(measurements.ttfb)'] as number,
    fid: projectData?.data[0]['p75(measurements.fid)'] as number,
  });

  // Do 3 queries filtering on LCP to get a spread of good, meh, and poor events
  // We can't query by performance score yet, so we're using LCP as a best estimate
  const {data: goodData, isLoading: isGoodTransactionWebVitalsQueryLoading} =
    useTransactionSamplesWebVitalsQuery({
      limit: 3,
      transaction: transaction ?? '',
      query: webVital
        ? `measurements.${webVital}:<${PERFORMANCE_SCORE_P90S[webVital]}`
        : undefined,
      enabled: Boolean(webVital),
    });

  const {data: mehData, isLoading: isMehTransactionWebVitalsQueryLoading} =
    useTransactionSamplesWebVitalsQuery({
      limit: 3,
      transaction: transaction ?? '',
      query: webVital
        ? `measurements.${webVital}:<${PERFORMANCE_SCORE_MEDIANS[webVital]} measurements.${webVital}:>=${PERFORMANCE_SCORE_P90S[webVital]}`
        : undefined,
      enabled: Boolean(webVital),
    });

  const {data: poorData, isLoading: isPoorTransactionWebVitalsQueryLoading} =
    useTransactionSamplesWebVitalsQuery({
      limit: 3,
      transaction: transaction ?? '',
      query: webVital
        ? `measurements.${webVital}:>=${PERFORMANCE_SCORE_MEDIANS[webVital]}`
        : undefined,
      enabled: Boolean(webVital),
    });

  const data = [...goodData, ...mehData, ...poorData];

  const isTransactionWebVitalsQueryLoading =
    isGoodTransactionWebVitalsQueryLoading ||
    isMehTransactionWebVitalsQueryLoading ||
    isPoorTransactionWebVitalsQueryLoading;

  const tableData: TransactionSampleRowWithScore[] = data.sort(
    (a, b) => a[`${webVital}Score`] - b[`${webVital}Score`]
  );

  const renderHeadCell = (col: Column) => {
    if (col.key === 'transaction') {
      return <NoOverflow>{col.name}</NoOverflow>;
    }
    if (col.key === 'webVital') {
      return <AlignRight>{`${webVital}`}</AlignRight>;
    }
    if (col.key === 'score') {
      return <AlignCenter>{`${webVital} ${col.name}`}</AlignCenter>;
    }
    return <NoOverflow>{col.name}</NoOverflow>;
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
      if (row[`measurements.${webVital}`] !== null) {
        return (
          <AlignCenter>
            <PerformanceBadge score={row[`${webVital}Score`]} />
          </AlignCenter>
        );
      }
      return null;
    }
    if (col.key === 'webVital') {
      if (row[key] === null) {
        return <NoValue>{t('(no value)')}</NoValue>;
      }
      const value = row[`measurements.${webVital}`];
      const formattedValue =
        webVital === 'cls' ? value?.toFixed(2) : getFormattedDuration(value);
      return <AlignRight>{formattedValue}</AlignRight>;
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

      return (
        <NoOverflow>
          {row.replayId && replayTarget && (
            <Link to={replayTarget}>{getShortEventId(row.replayId)}</Link>
          )}
        </NoOverflow>
      );
    }
    if (key === 'profile.id') {
      const eventSlug = generateEventSlug({...row, project: project?.slug});
      const eventTarget = getTransactionDetailsUrl(organization.slug, eventSlug);
      return (
        <NoOverflow>
          <Link to={eventTarget} onClick={onClose}>
            {row['profile.id']}
          </Link>
        </NoOverflow>
      );
    }
    return <AlignRight>{row[key]}</AlignRight>;
  };

  return (
    <PageErrorProvider>
      <DetailPanel detailKey={webVital ?? undefined} onClose={onClose}>
        {webVital && (
          <WebVitalDetailHeader
            value={
              webVital !== 'cls'
                ? getDuration(
                    (projectData?.data[0][`p75(measurements.${webVital})`] as number) /
                      1000,
                    2,
                    true
                  )
                : (
                    projectData?.data[0][`p75(measurements.${webVital})`] as number
                  ).toFixed(2)
            }
            webVital={webVital}
            score={projectScore[`${webVital}Score`]}
          />
        )}
        <GridEditable
          data={tableData}
          isLoading={isTransactionWebVitalsQueryLoading}
          columnOrder={columnOrder}
          columnSortBy={[sort]}
          grid={{
            renderHeadCell,
            renderBodyCell,
          }}
          location={location}
        />
        <PageErrorAlert />
      </DetailPanel>
    </PageErrorProvider>
  );
}

const NoOverflow = styled('span')`
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AlignRight = styled('span')<{color?: string}>`
  text-align: right;
  width: 100%;
  ${p => (p.color ? `color: ${p.color};` : '')}
`;

const AlignCenter = styled('span')`
  text-align: center;
  width: 100%;
`;

const NoValue = styled('span')`
  color: ${p => p.theme.gray300};
`;
