import {useState} from 'react';
import styled from '@emotion/styled';

import {BarChart} from 'sentry/components/charts/barChart';
import TransitionChart from 'sentry/components/charts/transitionChart';
import {CompactSelect, SelectOption} from 'sentry/components/compactSelect';
import {space} from 'sentry/styles/space';
import {Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {LoadingScreen} from 'sentry/views/starfish/components/chart';
import MiniChartPanel from 'sentry/views/starfish/components/miniChartPanel';

export type ChartSelectOptions = {
  title: string;
  yAxis: string;
  series?: Series[];
};

export function ScreensBarChart({
  chartHeight,
  chartOptions,
  isLoading,
}: {
  chartOptions: ChartSelectOptions[];
  chartHeight?: number;
  isLoading?: boolean;
}) {
  const [selectedDisplay, setChartSetting] = useState(0);
  const menuOptions: SelectOption<string>[] = [];

  for (const option of chartOptions) {
    menuOptions.push({
      value: option.yAxis,
      label: option.title,
      disabled: chartOptions[selectedDisplay].title === option.title,
    });
  }

  return (
    <MiniChartPanel>
      <HeaderContainer>
        <Header>
          <ChartLabel>
            <StyledCompactSelect
              options={menuOptions}
              value={chartOptions[selectedDisplay].yAxis}
              onChange={option => {
                const chartOption = chartOptions.findIndex(o => o.yAxis === option.value);
                if (defined(chartOption)) {
                  setChartSetting(chartOption);
                }
              }}
              triggerProps={{
                borderless: true,
                size: 'zero',
                'aria-label': chartOptions[selectedDisplay].title,
              }}
              offset={4}
            />
          </ChartLabel>
        </Header>
      </HeaderContainer>
      <TransitionChart
        loading={Boolean(isLoading)}
        reloading={Boolean(isLoading)}
        height={chartHeight ? `${chartHeight}px` : undefined}
      >
        <LoadingScreen loading={Boolean(isLoading)} />
        <BarChart
          height={chartHeight ?? 180}
          series={chartOptions[selectedDisplay].series ?? []}
          grid={{
            left: '0',
            right: '0',
            top: '16px',
            bottom: '0',
          }}
        />
      </TransitionChart>
    </MiniChartPanel>
  );
}

const ChartLabel = styled('p')`
  ${p => p.theme.text.cardTitle}
`;

const HeaderContainer = styled('div')`
  padding: 0 ${space(1)} ${space(1)} 0;
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
  font-weight: normal;
  margin: -${space(0.5)} -${space(1)} -${space(0.25)};
  min-width: 0;

  button {
    padding: ${space(0.5)} ${space(1)};
    font-size: ${p => p.theme.fontSizeLarge};
  }
`;
