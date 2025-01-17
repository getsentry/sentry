import {useMemo} from 'react';
import styled from '@emotion/styled';

import type {LineChartSeries} from 'sentry/components/charts/lineChart';
import {DrawerHeader} from 'sentry/components/globalDrawer/components';
import type {
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import getDuration from 'sentry/utils/duration/getDuration';
import {getShortEventId} from 'sentry/utils/events';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import useReplayExists from 'sentry/utils/replayCount/useReplayExists';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useRoutes} from 'sentry/utils/useRoutes';
import {WebVitalStatusLineChart} from 'sentry/views/insights/browser/webVitals/components/charts/webVitalStatusLineChart';
import {PerformanceBadge} from 'sentry/views/insights/browser/webVitals/components/performanceBadge';
import {WebVitalDetailHeader} from 'sentry/views/insights/browser/webVitals/components/webVitalDescription';
import {useProjectRawWebVitalsQuery} from 'sentry/views/insights/browser/webVitals/queries/rawWebVitalsQueries/useProjectRawWebVitalsQuery';
import {useProjectRawWebVitalsValuesTimeseriesQuery} from 'sentry/views/insights/browser/webVitals/queries/rawWebVitalsQueries/useProjectRawWebVitalsValuesTimeseriesQuery';
import {getWebVitalScoresFromTableDataRow} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/getWebVitalScoresFromTableDataRow';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import {useInteractionsCategorizedSamplesQuery} from 'sentry/views/insights/browser/webVitals/queries/useInteractionsCategorizedSamplesQuery';
import {useTransactionsCategorizedSamplesQuery} from 'sentry/views/insights/browser/webVitals/queries/useTransactionsCategorizedSamplesQuery';
import type {
  InteractionSpanSampleRowWithScore,
  TransactionSampleRowWithScore,
  WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';
import decodeBrowserTypes from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import useProfileExists from 'sentry/views/insights/browser/webVitals/utils/useProfileExists';
import {SampleDrawerBody} from 'sentry/views/insights/common/components/sampleDrawerBody';
import {SpanIndexedField, type SubregionCode} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {generateReplayLink} from 'sentry/views/performance/transactionSummary/utils';

type Column = GridColumnHeader;

const columnOrder: GridColumnOrder[] = [
  {key: 'id', width: COL_WIDTH_UNDEFINED, name: t('Transaction')},
  {key: 'replayId', width: COL_WIDTH_UNDEFINED, name: t('Replay')},
  {key: 'profile.id', width: COL_WIDTH_UNDEFINED, name: t('Profile')},
  {key: 'webVital', width: COL_WIDTH_UNDEFINED, name: t('Web Vital')},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: t('Score')},
];

const inpColumnOrder: GridColumnOrder[] = [
  {
    key: SpanIndexedField.SPAN_DESCRIPTION,
    width: COL_WIDTH_UNDEFINED,
    name: t('Interaction Target'),
  },
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
}: {
  webVital: WebVitals | null;
}) {
  const location = useLocation();
  const {projects} = useProjects();
  const organization = useOrganization();
  const routes = useRoutes();
  const {replayExists} = useReplayExists();

  const browserTypes = decodeBrowserTypes(location.query[SpanIndexedField.BROWSER_NAME]);
  const subregions = location.query[
    SpanIndexedField.USER_GEO_SUBREGION
  ] as SubregionCode[];
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

  const {data: projectData} = useProjectRawWebVitalsQuery({
    transaction,
    browserTypes,
    subregions,
  });
  const {data: projectScoresData} = useProjectWebVitalsScoresQuery({
    weightWebVital: webVital ?? 'total',
    transaction,
    browserTypes,
    subregions,
  });

  const projectScore = getWebVitalScoresFromTableDataRow(projectScoresData?.data?.[0]);

  const {data: transactionsTableData, isLoading: isTransactionWebVitalsQueryLoading} =
    useTransactionsCategorizedSamplesQuery({
      transaction: transaction ?? '',
      webVital,
      enabled: Boolean(webVital) && !isInp,
      browserTypes,
      subregions,
    });

  const {data: inpTableData, isLoading: isInteractionsLoading} =
    useInteractionsCategorizedSamplesQuery({
      transaction: transaction ?? '',
      enabled: Boolean(webVital) && isInp,
      browserTypes,
      subregions,
    });

  const {profileExists} = useProfileExists(
    inpTableData.filter(row => row['profile.id']).map(row => row['profile.id'])
  );

  const {data: timeseriesData, isLoading: isTimeseriesLoading} =
    useProjectRawWebVitalsValuesTimeseriesQuery({transaction, browserTypes, subregions});

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
      if (row[`measurements.${webVital}` as keyof typeof row] !== undefined) {
        return (
          <AlignCenter>
            <PerformanceBadge
              score={row[`${webVital}Score` as keyof typeof row] as number}
            />
          </AlignCenter>
        );
      }
      return null;
    }
    if (col.key === 'webVital') {
      // @ts-ignore TS(2551): Property 'measurements.null' does not exist on typ... Remove this comment to see the full error message
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
      const eventTarget = generateLinkToEventInTraceView({
        eventId: row.id,
        traceSlug: row.trace,
        timestamp: row.timestamp,
        projectSlug,
        organization,
        location,
        source: TraceViewSources.WEB_VITALS_MODULE,
      });
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
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return <AlignRight>{row[key]}</AlignRight>;
  };

  const renderInpBodyCell = (col: Column, row: InteractionSpanSampleRowWithScore) => {
    const {key} = col;
    if (key === 'score') {
      if (row[`measurements.${webVital}` as keyof typeof row] !== undefined) {
        return (
          <AlignCenter>
            <PerformanceBadge
              score={row[`${webVital}Score` as keyof typeof row] as number}
            />
          </AlignCenter>
        );
      }
      return null;
    }
    if (col.key === 'webVital') {
      // @ts-ignore TS(2551): Property 'measurements.cls' does not exist on type... Remove this comment to see the full error message
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
            : // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              row['transaction.duration'],
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
      if (
        !defined(project) ||
        !defined(row['profile.id']) ||
        !profileExists(row['profile.id'])
      ) {
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
    if (key === SpanIndexedField.SPAN_DESCRIPTION) {
      return (
        <NoOverflow>
          <Tooltip title={row[key]}>{row[key]}</Tooltip>
        </NoOverflow>
      );
    }
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return <AlignRight>{row[key]}</AlignRight>;
  };

  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const webVitalScore = projectScore[`${webVital}Score`];
  const webVitalValue = projectData?.data[0]?.[`p75(measurements.${webVital})`] as
    | number
    | undefined;

  return (
    <PageAlertProvider>
      <DrawerHeader />

      <SampleDrawerBody>
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
              data={inpTableData}
              isLoading={isInteractionsLoading}
              columnOrder={inpColumnOrder}
              columnSortBy={[inpSort]}
              grid={{
                renderHeadCell,
                renderBodyCell: renderInpBodyCell,
              }}
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
            />
          )}
        </TableContainer>
        <PageAlert />
      </SampleDrawerBody>
    </PageAlertProvider>
  );
}

const NoOverflow = styled('span')`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
