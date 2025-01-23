import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import type {LineChartSeries} from 'sentry/components/charts/lineChart';
import {DrawerHeader} from 'sentry/components/globalDrawer/components';
import type {
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
} from 'sentry/components/gridEditable';
import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import getDuration from 'sentry/utils/duration/getDuration';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {WebVitalStatusLineChart} from 'sentry/views/insights/browser/webVitals/components/charts/webVitalStatusLineChart';
import {PerformanceBadge} from 'sentry/views/insights/browser/webVitals/components/performanceBadge';
import {WebVitalDescription} from 'sentry/views/insights/browser/webVitals/components/webVitalDescription';
import {useProjectRawWebVitalsQuery} from 'sentry/views/insights/browser/webVitals/queries/rawWebVitalsQueries/useProjectRawWebVitalsQuery';
import {useProjectRawWebVitalsValuesTimeseriesQuery} from 'sentry/views/insights/browser/webVitals/queries/rawWebVitalsQueries/useProjectRawWebVitalsValuesTimeseriesQuery';
import {getWebVitalScoresFromTableDataRow} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/getWebVitalScoresFromTableDataRow';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import {useTransactionWebVitalsScoresQuery} from 'sentry/views/insights/browser/webVitals/queries/storedScoreQueries/useTransactionWebVitalsScoresQuery';
import {MODULE_DOC_LINK} from 'sentry/views/insights/browser/webVitals/settings';
import type {
  Row,
  RowWithScoreAndOpportunity,
  WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';
import decodeBrowserTypes from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {SampleDrawerBody} from 'sentry/views/insights/common/components/sampleDrawerBody';
import {SpanIndexedField, type SubregionCode} from 'sentry/views/insights/types';

type Column = GridColumnHeader;

const columnOrder: GridColumnOrder[] = [
  {key: 'transaction', width: COL_WIDTH_UNDEFINED, name: 'Pages'},
  {key: 'count', width: COL_WIDTH_UNDEFINED, name: 'Pageloads'},
  {key: 'webVital', width: COL_WIDTH_UNDEFINED, name: 'Web Vital'},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: 'Score'},
  {key: 'opportunity', width: COL_WIDTH_UNDEFINED, name: 'Opportunity'},
];

const sort: GridColumnSortBy<keyof Row> = {key: 'count()', order: 'desc'};

const MAX_ROWS = 10;

export function WebVitalsDetailPanel({webVital}: {webVital: WebVitals | null}) {
  const location = useLocation();
  const organization = useOrganization();
  const browserTypes = decodeBrowserTypes(location.query[SpanIndexedField.BROWSER_NAME]);
  const subregions = decodeList(
    location.query[SpanIndexedField.USER_GEO_SUBREGION]
  ) as SubregionCode[];

  const {data: projectData} = useProjectRawWebVitalsQuery({browserTypes, subregions});
  const {data: projectScoresData} = useProjectWebVitalsScoresQuery({
    weightWebVital: webVital ?? 'total',
    browserTypes,
    subregions,
  });

  const projectScore = getWebVitalScoresFromTableDataRow(projectScoresData?.data?.[0]);
  const {data, isPending} = useTransactionWebVitalsScoresQuery({
    limit: 100,
    webVital: webVital ?? 'total',
    ...(webVital
      ? {
          query: `count_scores(measurements.score.${webVital}):>0`,
          defaultSort: {
            field: `opportunity_score(measurements.score.${webVital})`,
            kind: 'desc',
          },
        }
      : {}),
    enabled: webVital !== null,
    sortName: 'webVitalsDetailPanelSort',
    browserTypes,
    subregions,
  });

  const dataByOpportunity = useMemo(() => {
    if (!data) {
      return [];
    }
    const sumWeights = projectScoresData?.data?.[0]?.[
      `sum(measurements.score.weight.${webVital})`
    ] as number;
    return data
      .map(row => ({
        ...row,
        opportunity:
          Math.round(
            (((row as RowWithScoreAndOpportunity).opportunity ?? 0) * 100 * 100) /
              sumWeights
          ) / 100,
      }))
      .sort((a, b) => {
        if (a.opportunity === undefined) {
          return 1;
        }
        if (b.opportunity === undefined) {
          return -1;
        }
        return b.opportunity - a.opportunity;
      })
      .slice(0, MAX_ROWS);
  }, [data, projectScoresData?.data, webVital]);

  const {data: timeseriesData, isLoading: isTimeseriesLoading} =
    useProjectRawWebVitalsValuesTimeseriesQuery({browserTypes, subregions});

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

  useEffect(() => {
    if (webVital !== null) {
      trackAnalytics('insight.vital.vital_sidebar_opened', {
        organization,
        vital: webVital,
      });
    }
  }, [organization, webVital]);

  const renderHeadCell = (col: Column) => {
    if (col.key === 'transaction') {
      return <NoOverflow>{col.name}</NoOverflow>;
    }
    if (col.key === 'webVital') {
      return <AlignRight>{`${webVital} P75`}</AlignRight>;
    }
    if (col.key === 'score') {
      return <AlignCenter>{`${webVital} ${col.name}`}</AlignCenter>;
    }
    if (col.key === 'opportunity') {
      return (
        <Tooltip
          isHoverable
          title={
            <span>
              {tct(
                "A number rating how impactful a performance improvement on this page would be to your application's [webVital] Performance Score.",
                {webVital: webVital?.toUpperCase() ?? ''}
              )}
              <br />
              <ExternalLink href={`${MODULE_DOC_LINK}#opportunity`}>
                {t('How is this calculated?')}
              </ExternalLink>
            </span>
          }
        >
          <OpportunityHeader>{col.name}</OpportunityHeader>
        </Tooltip>
      );
    }
    if (col.key === 'count') {
      if (webVital === 'inp') {
        return <AlignRight>{t('Interactions')}</AlignRight>;
      }
    }
    return <AlignRight>{col.name}</AlignRight>;
  };

  const getFormattedDuration = (value: number) => {
    if (value < 1000) {
      return getDuration(value / 1000, 0, true);
    }
    return getDuration(value / 1000, 2, true);
  };

  const renderBodyCell = (col: Column, row: RowWithScoreAndOpportunity) => {
    const {key} = col;
    if (key === 'score') {
      return (
        <AlignCenter>
          <PerformanceBadge score={row[`${webVital!}Score`]} />
        </AlignCenter>
      );
    }
    if (col.key === 'webVital') {
      let value: string | number = row[mapWebVitalToColumn(webVital)];
      if (webVital && ['lcp', 'fcp', 'ttfb', 'inp'].includes(webVital)) {
        value = getFormattedDuration(value);
      } else if (webVital === 'cls') {
        value = value?.toFixed(2);
      }
      return <AlignRight>{value}</AlignRight>;
    }
    if (key === 'transaction') {
      return (
        <NoOverflow>
          <Link
            to={{
              ...location,
              pathname: `${location.pathname}overview/`,
              query: {
                ...location.query,
                transaction: row.transaction,
                webVital,
                project: row['project.id'],
              },
            }}
          >
            {row.transaction}
          </Link>
        </NoOverflow>
      );
    }
    if (key === 'count') {
      const count =
        // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        webVital === 'inp' ? row['count_scores(measurements.score.inp)'] : row['count()'];
      return <AlignRight>{formatAbbreviatedNumber(count)}</AlignRight>;
    }
    // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    return <AlignRight>{row[key]}</AlignRight>;
  };

  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const webVitalScore = projectScore[`${webVital}Score`];
  const webVitalValue = projectData?.data?.[0]?.[mapWebVitalToColumn(webVital)] as
    | number
    | undefined;

  return (
    <PageAlertProvider>
      <DrawerHeader />

      <SampleDrawerBody>
        {webVital && (
          <WebVitalDescription
            value={
              webVitalValue !== undefined
                ? webVital !== 'cls'
                  ? getDuration(webVitalValue / 1000, 2, true)
                  : webVitalValue?.toFixed(2)
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
          <GridEditable
            data={dataByOpportunity}
            isLoading={isPending}
            columnOrder={columnOrder}
            columnSortBy={[sort]}
            grid={{
              renderHeadCell,
              renderBodyCell,
            }}
          />
        </TableContainer>
        <PageAlert />
      </SampleDrawerBody>
    </PageAlertProvider>
  );
}

const mapWebVitalToColumn = (webVital?: WebVitals | null) => {
  switch (webVital) {
    case 'lcp':
      return 'p75(measurements.lcp)';
    case 'fcp':
      return 'p75(measurements.fcp)';
    case 'cls':
      return 'p75(measurements.cls)';
    case 'ttfb':
      return 'p75(measurements.ttfb)';
    case 'inp':
      return 'p75(measurements.inp)';
    default:
      return 'count()';
  }
};

const NoOverflow = styled('span')`
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AlignRight = styled('span')<{color?: string}>`
  text-align: right;
  width: 100%;
  ${p => (p.color ? `color: ${p.color};` : '')}
`;

const ChartContainer = styled('div')`
  position: relative;
  flex: 1;
`;

const AlignCenter = styled('span')`
  text-align: center;
  width: 100%;
`;

const OpportunityHeader = styled('span')`
  ${p => p.theme.tooltipUnderline()};
`;

const TableContainer = styled('div')`
  margin-bottom: 80px;
`;
