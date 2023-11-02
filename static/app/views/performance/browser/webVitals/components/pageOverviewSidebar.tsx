import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ChartZoom from 'sentry/components/charts/chartZoom';
import {LineChart, LineChartSeries} from 'sentry/components/charts/lineChart';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {DEFAULT_RELATIVE_PERIODS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {addToFilter} from 'sentry/views/discover/table/cellAction';
import {Tags} from 'sentry/views/discover/tags';
import {MiniAggregateWaterfall} from 'sentry/views/performance/browser/webVitals/components/miniAggregateWaterfall';
import PerformanceScoreRingWithTooltips from 'sentry/views/performance/browser/webVitals/components/performanceScoreRingWithTooltips';
import {ProjectScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {useProjectWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsQuery';
import {useProjectWebVitalsValuesTimeseriesQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsValuesTimeseriesQuery';
import {SidebarSpacer} from 'sentry/views/performance/transactionSummary/utils';

const CHART_HEIGHTS = 100;

type Props = {
  transaction: string;
  projectScore?: ProjectScore;
  search?: string;
};

export function PageOverviewSidebar({projectScore, transaction}: Props) {
  const theme = useTheme();
  const router = useRouter();
  const pageFilters = usePageFilters();
  const location = useLocation();
  const organization = useOrganization();
  const api = useApi();
  const {period, start, end, utc} = pageFilters.selection.datetime;
  const query = decodeScalar(location.query.query);

  const {data, isLoading: isLoading} = useProjectWebVitalsValuesTimeseriesQuery({
    transaction,
  });

  // We need to query for indexed data since the tags facets component only works with indexed data
  const {data: indexedData, isLoading: isIndexedDataLoading} = useProjectWebVitalsQuery({
    transaction,
    dataset: DiscoverDatasets.DISCOVER,
  });

  let seriesData = !isLoading
    ? data?.eps.map(({name, value}) => ({
        name,
        value,
      }))
    : [];

  // Trim off last data point since it's incomplete
  if (seriesData.length > 0 && period && !start && !end) {
    seriesData = seriesData.slice(0, -1);
  }

  const throughtputData: LineChartSeries[] = [
    {
      data: seriesData,
      seriesName: t('Page Loads'),
    },
  ];

  const epsDiff = !isLoading
    ? seriesData[seriesData.length - 1].value / seriesData[0].value
    : undefined;
  const initialEps = !isLoading
    ? `${Math.round(seriesData[0].value * 100) / 100}/s`
    : undefined;
  const currentEps = !isLoading
    ? `${Math.round(seriesData[seriesData.length - 1].value * 100) / 100}/s`
    : undefined;

  const diffToColor = (diff?: number, reverse?: boolean) => {
    if (diff === undefined) {
      return undefined;
    }
    if (diff > 1) {
      if (reverse) {
        return theme.red300;
      }
      return theme.green300;
    }
    if (diff < 1) {
      if (reverse) {
        return theme.green300;
      }
      return theme.red300;
    }
    return undefined;
  };

  const ringSegmentColors = theme.charts.getColorPalette(3);
  const ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);
  const performanceScoreSubtext = (period && DEFAULT_RELATIVE_PERIODS[period]) ?? '';

  const eventView = EventView.fromNewQueryWithLocation(
    {
      fields: [],
      name: '',
      version: 1,
      query: `event.type:transaction transaction:"${transaction}"`,
    },
    location
  );

  return (
    <Fragment>
      <SectionHeading>
        {t('Performance Score')}
        <QuestionTooltip
          size="sm"
          title={t('Overall performance rating of your application')}
        />
      </SectionHeading>
      <PerformanceScoreSubText>{performanceScoreSubtext}</PerformanceScoreSubText>
      <SidebarPerformanceScoreRingContainer>
        {projectScore && (
          <PerformanceScoreRingWithTooltips
            projectScore={projectScore}
            text={projectScore.totalScore}
            width={220}
            height={160}
            ringBackgroundColors={ringBackgroundColors}
            ringSegmentColors={ringSegmentColors}
          />
        )}
      </SidebarPerformanceScoreRingContainer>
      <SidebarSpacer />
      <SectionHeading>
        {t('Page Loads')}
        <QuestionTooltip
          size="sm"
          title={t('The number of transactions per unit time')}
        />
      </SectionHeading>
      <ChartValue>{currentEps}</ChartValue>
      <ChartSubText color={diffToColor(epsDiff)}>
        {getChartSubText(epsDiff, initialEps, currentEps)}
      </ChartSubText>
      <ChartZoom router={router} period={period} start={start} end={end} utc={utc}>
        {zoomRenderProps => (
          <LineChart
            {...zoomRenderProps}
            height={CHART_HEIGHTS}
            series={throughtputData}
            xAxis={{show: false}}
            grid={{
              left: 0,
              right: 15,
              top: 10,
              bottom: -10,
            }}
            yAxis={{axisLabel: {formatter: value => `${value}/s`}}}
            tooltip={{valueFormatter: value => `${Math.round(value * 100) / 100}/s`}}
          />
        )}
      </ChartZoom>
      <SidebarSpacer />
      <SectionHeading>
        {t('Aggregate Spans')}
        <QuestionTooltip
          size="sm"
          title={t('Waterfall view displaying common span paths that the page may take')}
        />
      </SectionHeading>
      <MiniAggregateWaterfallContainer>
        <MiniAggregateWaterfall transaction={transaction} />
      </MiniAggregateWaterfallContainer>
      <SidebarSpacer />
      {!isIndexedDataLoading && (
        <Tags
          generateUrl={() => ''}
          totalValues={(indexedData?.data[0]['count()'] ?? 0) as number}
          eventView={eventView}
          organization={organization}
          location={location}
          api={api}
          onTagValueClick={(title, value) => {
            const mutableSearch = new MutableSearch(query ?? '');
            addToFilter(mutableSearch, title, value.name);
            router.replace({
              ...location,
              query: {
                ...location.query,
                query: mutableSearch.formatString(),
              },
            });
          }}
        />
      )}
    </Fragment>
  );
}

const getChartSubText = (
  diff?: number,
  value?: string | number,
  newValue?: string | number
) => {
  if (diff === undefined || value === undefined) {
    return null;
  }
  if (diff > 1) {
    const relativeDiff = Math.round((diff - 1) * 1000) / 10;
    if (relativeDiff === Infinity) {
      return `Up from ${value} to ${newValue}`;
    }
    return `Up ${relativeDiff}% from ${value}`;
  }
  if (diff < 1) {
    const relativeDiff = Math.round((1 - diff) * 1000) / 10;
    return `Down ${relativeDiff}% from ${value}`;
  }
  return t('No Change');
};

const SidebarPerformanceScoreRingContainer = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: ${space(1)};
`;

const ChartValue = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const ChartSubText = styled('div')<{color?: string}>`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.color ?? p.theme.subText};
`;

const SectionHeading = styled('h4')`
  display: inline-grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
`;

const MiniAggregateWaterfallContainer = styled('div')`
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
`;

const PerformanceScoreSubText = styled('div')`
  width: 100%;
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
  margin-bottom: ${space(1)};
`;
