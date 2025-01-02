import styled from '@emotion/styled';

import {BarChart} from 'sentry/components/charts/barChart';
import type {BaseChartProps} from 'sentry/components/charts/baseChart';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import TransitionChart from 'sentry/components/charts/transitionChart';
import type {SelectOption} from 'sentry/components/compactSelect';
import {CompactSelect} from 'sentry/components/compactSelect';
import {IconWarning} from 'sentry/icons/iconWarning';
import {space} from 'sentry/styles/space';
import type {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {
  axisLabelFormatter,
  getDurationUnit,
  tooltipFormatter,
} from 'sentry/utils/discover/charts';
import {aggregateOutputType} from 'sentry/utils/discover/fields';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useRouter from 'sentry/utils/useRouter';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {LoadingScreen} from 'sentry/views/insights/common/components/chart';
import MiniChartPanel from 'sentry/views/insights/common/components/miniChartPanel';

export type ChartSelectOptions = {
  title: string;
  yAxis: string;
  series?: Series[];
  subtitle?: string;
  xAxisLabel?: string[];
};

export function ScreensBarChart({
  chartHeight,
  chartKey,
  chartOptions,
  isLoading,
  chartProps,
}: {
  chartKey: string;
  chartOptions: ChartSelectOptions[];
  chartHeight?: number;
  chartProps?: BaseChartProps;
  isLoading?: boolean;
}) {
  const location = useLocation();
  const router = useRouter();
  const yAxis = decodeScalar(location.query[chartKey]);
  const selectedDisplay = yAxis ? chartOptions.findIndex(o => o.yAxis === yAxis) : 0;

  const menuOptions: SelectOption<string>[] = [];

  for (const option of chartOptions) {
    menuOptions.push({
      value: option.yAxis,
      label: option.title,
      disabled: chartOptions[selectedDisplay]?.title === option.title,
    });
  }

  return (
    <MiniChartPanel>
      <HeaderContainer>
        <Header>
          <ChartLabel>
            {chartOptions.length > 1 ? (
              <StyledCompactSelect
                options={menuOptions}
                value={chartOptions[selectedDisplay]?.yAxis}
                onChange={option => {
                  const chartOption = chartOptions.find(o => o.yAxis === option.value);
                  if (defined(chartOption)) {
                    router.replace({
                      pathname: router.location.pathname,
                      query: {...router.location.query, [chartKey]: chartOption.yAxis},
                    });
                  }
                }}
                triggerProps={{
                  borderless: true,
                  size: 'zero',
                  'aria-label': chartOptions[selectedDisplay]?.title,
                }}
                offset={4}
              />
            ) : (
              chartOptions[selectedDisplay]?.title
            )}
          </ChartLabel>
        </Header>
        {chartOptions[selectedDisplay]!.subtitle && (
          <Subtitle>{chartOptions[selectedDisplay]!.subtitle}</Subtitle>
        )}
      </HeaderContainer>
      <TransitionChart
        loading={Boolean(isLoading)}
        reloading={Boolean(isLoading)}
        height={chartHeight ? `${chartHeight}px` : undefined}
      >
        <LoadingScreen loading={Boolean(isLoading)} />
        {selectedDisplay === -1 ? (
          <ErrorPanel height={`${chartHeight ?? 180}px`}>
            <IconWarning color="gray300" size="lg" />
          </ErrorPanel>
        ) : (
          <BarChart
            {...chartProps}
            height={chartHeight ?? 180}
            series={
              chartOptions[selectedDisplay]!.series?.map(series => ({
                ...series,
                name: formatVersion(series.seriesName),
              })) ?? []
            }
            grid={{
              left: '0',
              right: '0',
              top: '8px',
              bottom: '0',
              containLabel: true,
            }}
            xAxis={{
              type: 'category',
              axisTick: {show: true},
              data: chartOptions[selectedDisplay]!.xAxisLabel,
              truncate: 14,
              axisLabel: {
                interval: 0,
              },
            }}
            yAxis={{
              axisLabel: {
                formatter(value: number) {
                  return axisLabelFormatter(
                    value,
                    aggregateOutputType(chartOptions[selectedDisplay]!.yAxis),
                    undefined,
                    getDurationUnit(chartOptions[selectedDisplay]!.series ?? [])
                  );
                },
              },
            }}
            tooltip={{
              valueFormatter: (value, _seriesName) => {
                return tooltipFormatter(
                  value,
                  aggregateOutputType(chartOptions[selectedDisplay]!.yAxis)
                );
              },
            }}
          />
        )}
      </TransitionChart>
    </MiniChartPanel>
  );
}

const ChartLabel = styled('p')`
  ${p => p.theme.text.cardTitle}
`;

const HeaderContainer = styled('div')`
  padding: 0 ${space(1)} 0 0;
`;

const Header = styled('div')`
  min-height: 24px;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const StyledCompactSelect = styled(CompactSelect)`
  /* Reset font-weight set by HeaderTitleLegend, buttons are already bold and
   * setting this higher up causes it to trickle into the menues */
  font-weight: ${p => p.theme.fontWeightNormal};
  margin: -${space(0.5)} -${space(1)} -${space(0.25)};
  min-width: 0;

  button {
    padding: ${space(0.5)} ${space(1)};
    font-size: ${p => p.theme.fontSizeLarge};
  }
`;

const Subtitle = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
  display: inline-block;
`;
