import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {DrawerHeader} from 'sentry/components/globalDrawer/components';
import type {
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
} from 'sentry/components/tables/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/tables/gridEditable';
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
import {getWebVitalScoresFromTableDataRow} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/getWebVitalScoresFromTableDataRow';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import {useSpanSamplesCategorizedQuery} from 'sentry/views/insights/browser/webVitals/queries/useSpanSamplesCategorizedQuery';
import type {
  SpanSampleRowWithScore,
  TransactionSampleRowWithScore,
  WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';
import decodeBrowserTypes from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import useProfileExists from 'sentry/views/insights/browser/webVitals/utils/useProfileExists';
import {SampleDrawerBody} from 'sentry/views/insights/common/components/sampleDrawerBody';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {SpanFields, type SubregionCode} from 'sentry/views/insights/types';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceHeader/breadcrumbs';
import {generateReplayLink} from 'sentry/views/performance/transactionSummary/utils';

type Column = GridColumnHeader;

const PAGELOADS_COLUMN_ORDER: GridColumnOrder[] = [
  {key: 'id', width: COL_WIDTH_UNDEFINED, name: t('Transaction')},
  {key: 'profile.id', width: COL_WIDTH_UNDEFINED, name: t('Profile')},
  {key: 'replayId', width: COL_WIDTH_UNDEFINED, name: t('Replay')},
  {key: 'webVital', width: COL_WIDTH_UNDEFINED, name: t('Web Vital')},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: t('Score')},
];

const SPANS_SAMPLES_COLUMN_ORDER: GridColumnOrder[] = [
  {key: 'id', width: COL_WIDTH_UNDEFINED, name: t('Trace')},
  {
    key: SpanFields.SPAN_DESCRIPTION,
    width: COL_WIDTH_UNDEFINED,
    name: t('Description'),
  },
  {key: 'profile.id', width: COL_WIDTH_UNDEFINED, name: t('Profile')},
  {key: 'replayId', width: COL_WIDTH_UNDEFINED, name: t('Replay')},
  {key: 'webVital', width: COL_WIDTH_UNDEFINED, name: t('Web Vital')},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: t('Score')},
];

const NO_VALUE = ' \u2014 ';

const sort: GridColumnSortBy<keyof TransactionSampleRowWithScore> = {
  key: 'totalScore',
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
  const domainViewFilters = useDomainViewFilters();

  const browserTypes = decodeBrowserTypes(location.query[SpanFields.BROWSER_NAME]);
  const subregions = location.query[SpanFields.USER_GEO_SUBREGION] as SubregionCode[];
  const isSpansWebVital = defined(webVital) && ['inp', 'cls', 'lcp'].includes(webVital);
  const isInp = webVital === 'inp';
  const useSpansWebVitals = organization.features.includes(
    'performance-vitals-standalone-cls-lcp'
  );

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

  const projectScore = getWebVitalScoresFromTableDataRow(projectScoresData?.[0]);

  const {data: spansTableData, isLoading: isSpansLoading} =
    useSpanSamplesCategorizedQuery({
      transaction: transaction ?? '',
      webVital,
      enabled: Boolean(webVital),
      browserTypes,
      subregions,
    });

  const {profileExists} = useProfileExists(
    spansTableData.filter(row => row['profile.id']).map(row => row['profile.id'])
  );

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

    if (col.key === SpanFields.SPAN_DESCRIPTION) {
      if (webVital === 'lcp') {
        return <span>{t('LCP Element')}</span>;
      }
      if (webVital === 'cls') {
        return <span>{t('CLS Source')}</span>;
      }
      if (webVital === 'inp') {
        return <span>{t('Interaction Target')}</span>;
      }
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

  const renderSpansBodyCell = (col: Column, row: SpanSampleRowWithScore) => {
    const {key} = col;
    if (key === 'score') {
      if (row[`${webVital}Score` as keyof typeof row] !== undefined) {
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
      // @ts-expect-error TS(2551): Property 'measurements.cls' does not exist on type... Remove this comment to see the full error message
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
          'transaction.duration': row[SpanFields.SPAN_SELF_TIME],
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
        organization,
        projectSlug: project.slug,
        profileId: String(row['profile.id']),
      });

      return (
        <AlignCenter>
          <Link to={target}>{getShortEventId(row['profile.id'])}</Link>
        </AlignCenter>
      );
    }

    if (key === SpanFields.SPAN_DESCRIPTION) {
      const description =
        webVital === 'lcp' && row[SpanFields.SPAN_OP] === 'pageload'
          ? row[SpanFields.LCP_ELEMENT]
          : webVital === 'cls' && row[SpanFields.SPAN_OP] === 'pageload'
            ? row[SpanFields.CLS_SOURCE]
            : row[key];

      if (description) {
        return (
          <NoOverflow>
            <Tooltip title={description}>{description}</Tooltip>
          </NoOverflow>
        );
      }
      return <NoOverflow>{NO_VALUE}</NoOverflow>;
    }
    if (key === 'id') {
      const eventTarget =
        project?.slug &&
        generateLinkToEventInTraceView({
          eventId: row.id,
          traceSlug: row.trace,
          timestamp: row.timestamp,
          organization,
          location,
          view: domainViewFilters.view,
          source: TraceViewSources.WEB_VITALS_MODULE,
        });
      return (
        <NoOverflow>
          {eventTarget ? (
            <Link to={eventTarget}>{getShortEventId(row.trace)}</Link>
          ) : (
            <span>{getShortEventId(row.id)}</span>
          )}
        </NoOverflow>
      );
    }
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return <AlignRight>{row[key]}</AlignRight>;
  };

  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const webVitalScore = projectScore[`${webVital}Score`];
  const webVitalValue = webVital
    ? projectData?.[0]?.[`p75(measurements.${webVital})`]
    : undefined;

  return (
    <PageAlertProvider>
      <DrawerHeader />

      <SampleDrawerBody>
        {webVital && (
          <WebVitalDetailHeader
            value={
              webVitalValue === undefined
                ? undefined
                : webVital === 'cls'
                  ? webVitalValue?.toFixed(2)
                  : getDuration(webVitalValue / 1000, 2, true)
            }
            webVital={webVital}
            score={webVitalScore}
          />
        )}
        <ChartContainer>
          {webVital && (
            <WebVitalStatusLineChart
              webVital={webVital}
              transaction={transaction}
              browserTypes={browserTypes}
              subregions={subregions}
            />
          )}
        </ChartContainer>
        <TableContainer>
          {isInp ? (
            <GridEditable
              data={spansTableData}
              isLoading={isSpansLoading}
              columnOrder={SPANS_SAMPLES_COLUMN_ORDER}
              columnSortBy={[sort]}
              grid={{
                renderHeadCell,
                renderBodyCell: renderSpansBodyCell,
              }}
            />
          ) : (
            <GridEditable
              data={spansTableData}
              isLoading={isSpansLoading}
              columnOrder={
                isSpansWebVital && useSpansWebVitals
                  ? SPANS_SAMPLES_COLUMN_ORDER
                  : PAGELOADS_COLUMN_ORDER
              }
              columnSortBy={[sort]}
              grid={{
                renderHeadCell,
                renderBodyCell: renderSpansBodyCell,
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
  color: ${p => p.theme.tokens.content.secondary};
`;

const TableContainer = styled('div')`
  margin-bottom: 80px;
`;
