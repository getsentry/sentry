import styled from '@emotion/styled';

// import {SectionHeading} from 'sentry/components/charts/styles';
import {space} from 'sentry/styles/space';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {useSpanIndexedSeries} from 'sentry/views/insights/common/queries/useDiscoverSeries';

type Props = {
  transactionName: string;
};

const REFERRER = 'eap-sidebar-charts';

export function EAPSidebarCharts({transactionName}: Props) {
  const {
    data: failureRateData,
    isPending: isFailureRatePending,
    isError: isFailureRateError,
  } = useSpanIndexedSeries(
    {
      search: new MutableSearch(`transaction:${transactionName}`),
      yAxis: ['failure_rate()'],
    },
    REFERRER,
    DiscoverDatasets.SPANS_EAP
  );

  if (isFailureRatePending || isFailureRateError) {
    return (
      <ChartContainer>
        <TimeSeriesWidgetVisualization.LoadingPlaceholder />
      </ChartContainer>
    );
  }

  console.dir(failureRateData);

  return <ChartContainer>EAPSidebarCharts</ChartContainer>;
}

const ChartContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

// const RelativeBox = styled('div')`
//   position: relative;
// `;

// const ChartTitle = styled(SectionHeading)`
//   margin: 0;
// `;

// const ChartLabel = styled('div')<{top: string}>`
//   position: absolute;
//   top: ${p => p.top};
//   z-index: 1;
// `;

// const ChartValue = styled('div')`
//   font-size: ${p => p.theme.fontSizeExtraLarge};
// `;
