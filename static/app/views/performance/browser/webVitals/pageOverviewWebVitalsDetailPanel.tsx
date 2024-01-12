import {useMemo} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';

import {LineChartSeries} from 'sentry/components/charts/lineChart';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {getDuration} from 'sentry/utils/formatters';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useRoutes} from 'sentry/utils/useRoutes';
import {PerformanceBadge} from 'sentry/views/performance/browser/webVitals/components/performanceBadge';
import {WebVitalDetailHeader} from 'sentry/views/performance/browser/webVitals/components/webVitalDescription';
import {WebVitalStatusLineChart} from 'sentry/views/performance/browser/webVitals/components/webVitalStatusLineChart';
import {
  calculatePerformanceScoreFromTableDataRow,
  PERFORMANCE_SCORE_MEDIANS,
  PERFORMANCE_SCORE_P90S,
} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import {useProjectRawWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useProjectRawWebVitalsQuery';
import {useProjectRawWebVitalsValuesTimeseriesQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useProjectRawWebVitalsValuesTimeseriesQuery';
import {useTransactionSamplesWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/useTransactionSamplesWebVitalsQuery';
import {
  TransactionSampleRowWithScore,
  WebVitals,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {generateReplayLink} from 'sentry/views/performance/transactionSummary/utils';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';

type Column = GridColumnHeader;

const columnOrder: GridColumnOrder[] = [
  {key: 'id', width: COL_WIDTH_UNDEFINED, name: 'Transaction'},
  {key: 'replayId', width: COL_WIDTH_UNDEFINED, name: 'Replay'},
  {key: 'profile.id', width: COL_WIDTH_UNDEFINED, name: 'Profile'},
  {key: 'webVital', width: COL_WIDTH_UNDEFINED, name: 'Web Vital'},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: 'Score'},
];

const sort: GridColumnSortBy<keyof TransactionSampleRowWithScore> = {
  key: 'totalScore',
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

  const {data: projectData} = useProjectRawWebVitalsQuery({transaction});

  const projectScore = calculatePerformanceScoreFromTableDataRow(projectData?.data?.[0]);

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
      withProfiles: true,
      sortName: 'webVitalSort',
      webVital: webVital ?? undefined,
    });

  const {data: mehData, isLoading: isMehTransactionWebVitalsQueryLoading} =
    useTransactionSamplesWebVitalsQuery({
      limit: 3,
      transaction: transaction ?? '',
      query: webVital
        ? `measurements.${webVital}:<${PERFORMANCE_SCORE_MEDIANS[webVital]} measurements.${webVital}:>=${PERFORMANCE_SCORE_P90S[webVital]}`
        : undefined,
      enabled: Boolean(webVital),
      withProfiles: true,
      sortName: 'webVitalSort',
      webVital: webVital ?? undefined,
    });

  const {data: poorData, isLoading: isPoorTransactionWebVitalsQueryLoading} =
    useTransactionSamplesWebVitalsQuery({
      limit: 3,
      transaction: transaction ?? '',
      query: webVital
        ? `measurements.${webVital}:>=${PERFORMANCE_SCORE_MEDIANS[webVital]}`
        : undefined,
      enabled: Boolean(webVital),
      withProfiles: true,
      sortName: 'webVitalSort',
      webVital: webVital ?? undefined,
    });

  const data = [...goodData, ...mehData, ...poorData];

  const isTransactionWebVitalsQueryLoading =
    isGoodTransactionWebVitalsQueryLoading ||
    isMehTransactionWebVitalsQueryLoading ||
    isPoorTransactionWebVitalsQueryLoading;

  const tableData: TransactionSampleRowWithScore[] = data.sort(
    (a, b) => a[`${webVital}Score`] - b[`${webVital}Score`]
  );

  const {data: timeseriesData, isLoading: isTimeseriesLoading} =
    useProjectRawWebVitalsValuesTimeseriesQuery({transaction});

  const webVitalData: LineChartSeries = {
    data:
      !isTimeseriesLoading && webVital
        ? timeseriesData?.[webVital].map(({name, value}) => ({
            name,
            value,
          }))
        : [],
    seriesName: webVital ?? '',
  };

  const getProjectSlug = (row: TransactionSampleRowWithScore): string => {
    return project && !Array.isArray(location.query.project)
      ? project.slug
      : row.projectSlug;
  };

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
    if (col.key === 'replayId' || col.key === 'profile.id') {
      return <AlignCenter>{col.name}</AlignCenter>;
    }
    return <NoOverflow>{col.name}</NoOverflow>;
  };

  const getFormattedDuration = (value: number) => {
    if (value === undefined) {
      return null;
    }
    if (value < 1000) {
      return getDuration(value / 1000, 0, true);
    }
    return getDuration(value / 1000, 2, true);
  };

  const renderBodyCell = (col: Column, row: TransactionSampleRowWithScore) => {
    const {key} = col;
    const projectSlug = getProjectSlug(row);
    if (key === 'score') {
      if (row[`measurements.${webVital}`] !== undefined) {
        return (
          <AlignCenter>
            <PerformanceBadge score={row[`${webVital}Score`]} />
          </AlignCenter>
        );
      }
      return null;
    }
    if (col.key === 'webVital') {
      const value = row[`measurements.${webVital}`];
      if (value === undefined) {
        return (
          <AlignRight>
            <NoValue>{t('(no value)')}</NoValue>
          </AlignRight>
        );
      }
      const formattedValue =
        webVital === 'cls' ? value?.toFixed(2) : getFormattedDuration(value);
      return <AlignRight>{formattedValue}</AlignRight>;
    }
    if (key === 'id') {
      const eventSlug = generateEventSlug({...row, project: projectSlug});
      const eventTarget = getTransactionDetailsUrl(organization.slug, eventSlug);
      return (
        <NoOverflow>
          <Link to={eventTarget}>{getShortEventId(row.id)}</Link>
        </NoOverflow>
      );
    }
    if (key === 'replayId') {
      const replayTarget =
        row['transaction.duration'] !== undefined &&
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
        <AlignCenter>
          <NoValue>{t('(no value)')}</NoValue>
        </AlignCenter>
      );
    }
    if (key === 'profile.id') {
      if (!defined(project) || !defined(row['profile.id'])) {
        return (
          <AlignCenter>
            <NoValue>{t('(no value)')}</NoValue>
          </AlignCenter>
        );
      }
      const target = generateProfileFlamechartRoute({
        orgSlug: organization.slug,
        projectSlug,
        profileId: String(row['profile.id']),
      });

      return (
        <AlignCenter>
          <Link to={target}>{getShortEventId(row['profile.id'])}</Link>
        </AlignCenter>
      );
    }
    return <AlignRight>{row[key]}</AlignRight>;
  };

  const webVitalScore = projectScore[`${webVital}Score`];

  return (
    <PageErrorProvider>
      <DetailPanel detailKey={webVital ?? undefined} onClose={onClose}>
        {webVital && projectData && webVitalScore !== undefined && (
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
                  )?.toFixed(2)
            }
            webVital={webVital}
            score={webVitalScore}
          />
        )}
        <ChartContainer>
          {webVital && <WebVitalStatusLineChart webVitalSeries={webVitalData} />}
        </ChartContainer>
        <TableContainer>
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
        </TableContainer>
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

const ChartContainer = styled('div')`
  position: relative;
  flex: 1;
`;

const NoValue = styled('span')`
  color: ${p => p.theme.gray300};
`;

const TableContainer = styled('div')`
  margin-bottom: 80px;
`;
