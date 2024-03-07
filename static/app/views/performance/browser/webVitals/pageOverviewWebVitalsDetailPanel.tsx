import {useMemo} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';

import type {LineChartSeries} from 'sentry/components/charts/lineChart';
import type {
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {getDuration} from 'sentry/utils/formatters';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import useReplayExists from 'sentry/utils/replayCount/useReplayExists';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useRoutes} from 'sentry/utils/useRoutes';
import {PerformanceBadge} from 'sentry/views/performance/browser/webVitals/components/performanceBadge';
import {WebVitalDetailHeader} from 'sentry/views/performance/browser/webVitals/components/webVitalDescription';
import {WebVitalStatusLineChart} from 'sentry/views/performance/browser/webVitals/components/webVitalStatusLineChart';
import {calculatePerformanceScoreFromTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import {useProjectRawWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useProjectRawWebVitalsQuery';
import {useProjectRawWebVitalsValuesTimeseriesQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useProjectRawWebVitalsValuesTimeseriesQuery';
import {calculatePerformanceScoreFromStoredTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/calculatePerformanceScoreFromStored';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import {useInteractionsCategorizedSamplesQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/useInteractionsCategorizedSamplesQuery';
import {useTransactionsCategorizedSamplesQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/useTransactionsCategorizedSamplesQuery';
import type {
  InteractionSpanSampleRowWithScore,
  TransactionSampleRowWithScore,
  WebVitals,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useStoredScoresSetting} from 'sentry/views/performance/browser/webVitals/utils/useStoredScoresSetting';
import {generateReplayLink} from 'sentry/views/performance/transactionSummary/utils';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';
import {SpanIndexedField} from 'sentry/views/starfish/types';

type Column = GridColumnHeader;

const columnOrder: GridColumnOrder[] = [
  {key: 'id', width: COL_WIDTH_UNDEFINED, name: t('Transaction')},
  {key: 'replayId', width: COL_WIDTH_UNDEFINED, name: t('Replay')},
  {key: 'profile.id', width: COL_WIDTH_UNDEFINED, name: t('Profile')},
  {key: 'webVital', width: COL_WIDTH_UNDEFINED, name: t('Web Vital')},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: t('Score')},
];

const inpColumnOrder: GridColumnOrder[] = [
  {key: 'profile.id', width: COL_WIDTH_UNDEFINED, name: t('Profile')},
  {key: 'replayId', width: COL_WIDTH_UNDEFINED, name: t('Replay')},
  {key: 'webVital', width: COL_WIDTH_UNDEFINED, name: t('Inp')},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: t('Score')},
];

const sort: GridColumnSortBy<keyof TransactionSampleRowWithScore> = {
  key: 'totalScore',
  order: 'desc',
};

const inpSort: GridColumnSortBy<keyof InteractionSpanSampleRowWithScore> = {
  key: 'inpScore',
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
  const {replayExists} = useReplayExists();
  const shouldUseStoredScores = useStoredScoresSetting();

  const isInp = webVital === 'inp';

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
  const {data: projectScoresData} = useProjectWebVitalsScoresQuery({
    enabled: shouldUseStoredScores,
    weightWebVital: webVital ?? 'total',
    transaction,
  });

  const projectScore = shouldUseStoredScores
    ? calculatePerformanceScoreFromStoredTableDataRow(projectScoresData?.data?.[0])
    : calculatePerformanceScoreFromTableDataRow(projectData?.data?.[0]);

  const {data: transactionsTableData, isLoading: isTransactionWebVitalsQueryLoading} =
    useTransactionsCategorizedSamplesQuery({
      transaction: transaction ?? '',
      webVital,
      enabled: Boolean(webVital) && !isInp,
    });

  const {data: inpTableData, isLoading: isInteractionsLoading} =
    useInteractionsCategorizedSamplesQuery({
      transaction: transaction ?? '',
      enabled: Boolean(webVital) && isInp,
    });

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
    if (col.key === 'score' || col.key === 'measurements.score.inp') {
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

      return row.replayId && replayTarget && replayExists(row[key]) ? (
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

  const renderInpBodyCell = (col: Column, row: InteractionSpanSampleRowWithScore) => {
    const {key} = col;
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
    if (key === 'replayId') {
      const replayTarget = replayLinkGenerator(
        organization,
        {
          replayId: row.replayId,
          id: '', // id doesn't actually matter here. Just to satisfy type.
          'transaction.duration': isInp
            ? row[SpanIndexedField.SPAN_SELF_TIME]
            : row['transaction.duration'],
          timestamp: row.timestamp,
        },
        undefined
      );

      return row.replayId && replayTarget && replayExists(row[key]) ? (
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
        projectSlug: project.slug,
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
  const webVitalValue = projectData?.data[0]?.[`p75(measurements.${webVital})`] as
    | number
    | undefined;

  return (
    <PageAlertProvider>
      <DetailPanel detailKey={webVital ?? undefined} onClose={onClose}>
        {webVital && (
          <WebVitalDetailHeader
            value={
              webVitalValue !== undefined
                ? webVital !== 'cls'
                  ? getDuration(webVitalValue / 1000, 2, true)
                  : (webVitalValue as number)?.toFixed(2)
                : undefined
            }
            webVital={webVital}
            score={webVitalScore}
          />
        )}
        <ChartContainer>
          {webVital && <WebVitalStatusLineChart webVitalSeries={webVitalData} />}
        </ChartContainer>
        <TableContainer>
          {isInp ? (
            <GridEditable
              data={inpTableData as unknown as InteractionSpanSampleRowWithScore[]}
              isLoading={isInteractionsLoading}
              columnOrder={inpColumnOrder}
              columnSortBy={[inpSort]}
              grid={{
                renderHeadCell,
                renderBodyCell: renderInpBodyCell,
              }}
              location={location}
            />
          ) : (
            <GridEditable
              data={transactionsTableData}
              isLoading={isTransactionWebVitalsQueryLoading}
              columnOrder={columnOrder}
              columnSortBy={[sort]}
              grid={{
                renderHeadCell,
                renderBodyCell,
              }}
              location={location}
            />
          )}
        </TableContainer>
        <PageAlert />
      </DetailPanel>
    </PageAlertProvider>
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
