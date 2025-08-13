import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {ChartContainer, HeaderTitleLegend} from 'sentry/components/charts/styles';
import {Tag} from 'sentry/components/core/badge/tag';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconCalendar, IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import getDynamicText from 'sentry/utils/getDynamicText';

// Sample data for the coverage trend chart
const SAMPLE_CHART_DATA = [
  {name: '2025-11-01T00:00:00Z', value: 85.2},
  {name: '2025-11-02T00:00:00Z', value: 87.4},
  {name: '2025-11-03T00:00:00Z', value: 86.8},
  {name: '2025-11-04T00:00:00Z', value: 88.9},
  {name: '2025-11-05T00:00:00Z', value: 91.2},
  {name: '2025-11-06T00:00:00Z', value: 89.7},
  {name: '2025-11-07T00:00:00Z', value: 92.1},
  {name: '2025-11-08T00:00:00Z', value: 90.8},
  {name: '2025-11-09T00:00:00Z', value: 93.5},
  {name: '2025-11-10T00:00:00Z', value: 94.2},
  {name: '2025-11-11T00:00:00Z', value: 92.9},
  {name: '2025-11-12T00:00:00Z', value: 95.1},
  {name: '2025-11-13T00:00:00Z', value: 94.7},
  {name: '2025-11-14T00:00:00Z', value: 96.3},
  {name: '2025-11-15T00:00:00Z', value: 95.8},
  {name: '2025-11-16T00:00:00Z', value: 97.2},
  {name: '2025-11-17T00:00:00Z', value: 96.9},
  {name: '2025-11-18T00:00:00Z', value: 98.1},
  {name: '2025-11-19T00:00:00Z', value: 97.6},
  {name: '2025-11-20T00:00:00Z', value: 98.5},
  {name: '2025-11-21T00:00:00Z', value: 98.7},
  {name: '2025-11-22T00:00:00Z', value: 98.9},
  {name: '2025-11-23T00:00:00Z', value: 98.2},
  {name: '2025-11-24T00:00:00Z', value: 98.98},
];

export default function CoverageTrendPage() {
  const theme = useTheme();

  return (
    <Fragment>
      <PageHeader>
        <HeaderTitle>
          {t('Coverage based on the selected branch: Main branch')}
        </HeaderTitle>
        <TimeRangeSelector>
          <IconCalendar size="sm" />
          <span>30D</span>
          <IconChevron direction="down" size="xs" />
        </TimeRangeSelector>
      </PageHeader>

      <MainLayout>
        <CoverageStatsPanel>
          <PanelHeader>{t('Coverage')}</PanelHeader>
          <StyledPanelBody>
            <CoverageValueRow>
              <CoverageValue>98.98%</CoverageValue>
              <Tag type="success">+0.25%</Tag>
            </CoverageValueRow>
            <CoverageDescription>
              {t(
                '98.98% is the coverage percentage based on the last commit of the day: d677638 in main branch on Nov 24, 2025.'
              )}
            </CoverageDescription>
          </StyledPanelBody>
        </CoverageStatsPanel>

        <CoverageTrendPanel>
          <ChartContainer>
            <HeaderTitleLegend>{t('Coverage Trend on Main branch')}</HeaderTitleLegend>
            <ChartWrapper>
              {getDynamicText({
                value: (
                  <AreaChart
                    height={350}
                    isGroupedByDate
                    showTimeInTooltip={false}
                    series={[
                      {
                        seriesName: t('Coverage'),
                        data: SAMPLE_CHART_DATA,
                        color: theme.chart.getColorPalette(0)[0],
                      },
                    ]}
                    legend={{right: 10, top: 0}}
                    options={{
                      grid: {left: '10px', right: '10px', top: '40px', bottom: '0px'},
                      yAxis: {
                        axisLabel: {
                          formatter: (value: number) => `${value}%`,
                        },
                        scale: true,
                      },
                    }}
                  />
                ),
                fixed: `${t('Coverage Trend')} Chart`,
              })}
            </ChartWrapper>
          </ChartContainer>
        </CoverageTrendPanel>
      </MainLayout>
    </Fragment>
  );
}

const PageHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: ${space(3)};
  gap: ${space(4)};
`;

const HeaderTitle = styled('h2')`
  font-size: 16px;
  font-weight: 500;
  line-height: 1.4;
  color: ${p => p.theme.textColor};
  margin: 0;
`;

const TimeRangeSelector = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
  padding: 0 ${space(2)};
  height: 38px;
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: 0 1px 2px rgba(43, 34, 51, 0.04);
  font-size: 14px;
  font-weight: 500;
  color: ${p => p.theme.textColor};
  cursor: pointer;

  &:hover {
    border-color: ${p => p.theme.gray300};
  }
`;

const MainLayout = styled('div')`
  display: grid;
  grid-template-columns: 318px 1fr;
  gap: ${space(3)};
`;

const CoverageStatsPanel = styled(Panel)`
  margin-bottom: 0;
`;

const CoverageTrendPanel = styled(Panel)`
  margin-bottom: 0;
`;

const StyledPanelBody = styled(PanelBody)`
  padding: 20px;
`;

const CoverageValueRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

const CoverageValue = styled('div')`
  font-size: 35px;
  font-weight: 400;
  line-height: 1.14;
  color: ${p => p.theme.textColor};
`;

const CoverageDescription = styled('div')`
  font-size: 14px;
  line-height: 1.19;
  color: ${p => p.theme.textColor};
  margin-bottom: ${space(2)};
`;

const ChartWrapper = styled('div')`
  padding-top: 20px;
`;
