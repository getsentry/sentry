import {useMemo} from 'react';
import {Link} from 'react-router';
import styled from '@emotion/styled';
import toUpper from 'lodash/toUpper';

import {LineChartSeries} from 'sentry/components/charts/lineChart';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
} from 'sentry/components/gridEditable';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {getDuration} from 'sentry/utils/formatters';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {PerformanceBadge} from 'sentry/views/performance/browser/webVitals/components/performanceBadge';
import {WebVitalDescription} from 'sentry/views/performance/browser/webVitals/components/webVitalDescription';
import {WebVitalStatusLineChart} from 'sentry/views/performance/browser/webVitals/components/webVitalStatusLineChart';
import {calculateOpportunity} from 'sentry/views/performance/browser/webVitals/utils/calculateOpportunity';
import {calculatePerformanceScoreFromTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/calculatePerformanceScore';
import {useProjectRawWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useProjectRawWebVitalsQuery';
import {useProjectRawWebVitalsValuesTimeseriesQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/rawWebVitalsQueries/useProjectRawWebVitalsValuesTimeseriesQuery';
import {calculatePerformanceScoreFromStoredTableDataRow} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/calculatePerformanceScoreFromStored';
import {useProjectWebVitalsScoresQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/storedScoreQueries/useProjectWebVitalsScoresQuery';
import {useTransactionWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/queries/useTransactionWebVitalsQuery';
import {
  Row,
  RowWithScoreAndOpportunity,
  WebVitals,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useStoredScoresSetting} from 'sentry/views/performance/browser/webVitals/utils/useStoredScoresSetting';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';

type Column = GridColumnHeader;

const columnOrder: GridColumnOrder[] = [
  {key: 'transaction', width: COL_WIDTH_UNDEFINED, name: 'Pages'},
  {key: 'count()', width: COL_WIDTH_UNDEFINED, name: 'Pageloads'},
  {key: 'webVital', width: COL_WIDTH_UNDEFINED, name: 'Web Vital'},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: 'Score'},
  {key: 'opportunity', width: COL_WIDTH_UNDEFINED, name: 'Opportunity'},
];

const sort: GridColumnSortBy<keyof Row> = {key: 'count()', order: 'desc'};

const MAX_ROWS = 10;

export function WebVitalsDetailPanel({
  webVital,
  onClose,
}: {
  onClose: () => void;
  webVital: WebVitals | null;
}) {
  const organization = useOrganization();
  const location = useLocation();
  const shouldUseStoredScores = useStoredScoresSetting();

  const {data: projectData} = useProjectRawWebVitalsQuery({});
  const {data: projectScoresData} = useProjectWebVitalsScoresQuery({
    enabled: shouldUseStoredScores,
    weightWebVital: webVital ?? 'total',
  });

  const projectScore = shouldUseStoredScores
    ? calculatePerformanceScoreFromStoredTableDataRow(projectScoresData?.data?.[0])
    : calculatePerformanceScoreFromTableDataRow(projectData?.data?.[0]);

  const {data, isLoading} = useTransactionWebVitalsQuery({
    limit: 100,
    opportunityWebVital: webVital ?? 'total',
    ...(webVital
      ? shouldUseStoredScores
        ? {
            query: `count_scores(measurements.score.${webVital}):>0`,
            defaultSort: {
              field: `opportunity_score(measurements.score.${webVital})`,
              kind: 'desc',
            },
          }
        : {
            query: `count_web_vitals(measurements.${webVital},any):>0`,
          }
      : {}),
    enabled: webVital !== null,
  });

  const dataByOpportunity = useMemo(() => {
    if (!data) {
      return [];
    }
    const count = projectData?.data?.[0]?.['count()'] as number;
    const sumWeights = projectScoresData?.data?.[0]?.[
      `sum(measurements.score.weight.${webVital})`
    ] as number;
    return data
      .map(row => ({
        ...row,
        opportunity: shouldUseStoredScores
          ? Math.round(
              (((row as RowWithScoreAndOpportunity).opportunity ?? 0) * 100 * 100) /
                sumWeights
            ) / 100
          : calculateOpportunity(
              projectScore[`${webVital}Score`],
              count,
              row[`${webVital}Score`],
              row['count()']
            ),
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
  }, [
    data,
    projectData?.data,
    projectScore,
    projectScoresData?.data,
    shouldUseStoredScores,
    webVital,
  ]);

  const {data: timeseriesData, isLoading: isTimeseriesLoading} =
    useProjectRawWebVitalsValuesTimeseriesQuery({});

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

  const detailKey = webVital;

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
                {webVital: webVital ? toUpper(webVital) : ''}
              )}
              <br />
              <ExternalLink href="https://docs.sentry.io/product/performance/web-vitals/#opportunity">
                {t('How is this calculated?')}
              </ExternalLink>
            </span>
          }
        >
          <OpportunityHeader>{col.name}</OpportunityHeader>
        </Tooltip>
      );
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
          <PerformanceBadge score={row[`${webVital}Score`]} />
        </AlignCenter>
      );
    }
    if (col.key === 'webVital') {
      let value: string | number = row[mapWebVitalToColumn(webVital)];
      if (webVital && ['lcp', 'fcp', 'ttfb', 'fid'].includes(webVital)) {
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
              ...(organization.features.includes(
                'starfish-browser-webvitals-pageoverview-v2'
              )
                ? {pathname: `${location.pathname}overview/`}
                : {}),
              query: {
                ...location.query,
                transaction: row.transaction,
                webVital,
              },
            }}
          >
            {row.transaction}
          </Link>
        </NoOverflow>
      );
    }
    return <AlignRight>{row[key]}</AlignRight>;
  };

  const webVitalScore = projectScore[`${webVital}Score`];

  return (
    <PageErrorProvider>
      <DetailPanel detailKey={detailKey ?? undefined} onClose={onClose}>
        {webVital && webVitalScore !== undefined && (
          <WebVitalDescription
            value={
              webVital !== 'cls'
                ? getDuration(
                    (projectData?.data?.[0]?.[mapWebVitalToColumn(webVital)] as number) /
                      1000,
                    2,
                    true
                  )
                : (
                    projectData?.data?.[0]?.[mapWebVitalToColumn(webVital)] as number
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
            data={dataByOpportunity}
            isLoading={isLoading}
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
    case 'fid':
      return 'p75(measurements.fid)';
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
