import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import BaseChart from 'sentry/components/charts/baseChart';
import {computeChartTooltip} from 'sentry/components/charts/components/tooltip';
import AreaSeries from 'sentry/components/charts/series/areaSeries';
import {Tag} from 'sentry/components/core/badge/tag';
import {Tooltip} from 'sentry/components/core/tooltip';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {IconCalendar, IconChevron, IconOpen} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Series} from 'sentry/types/echarts';

// Sample data for the coverage trend chart
const SAMPLE_CHART_DATA: Series[] = [
  {
    seriesName: 'Coverage',
    data: [
      {name: '2025-11-20T00:00:00Z', value: 98.5},
      {name: '2025-11-21T00:00:00Z', value: 98.7},
      {name: '2025-11-22T00:00:00Z', value: 98.9},
      {name: '2025-11-23T00:00:00Z', value: 98.8},
      {name: '2025-11-24T00:00:00Z', value: 98.98},
    ],
  },
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
          <StyledPanelHeader>{t('Coverage')}</StyledPanelHeader>
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
          <StyledPanelHeader>{t('Coverage Trend on Main branch')}</StyledPanelHeader>
          <ChartContainer>
            <BaseChart
              height={350}
              isGroupedByDate
              showTimeInTooltip={false}
              colors={['#444674']}
              series={SAMPLE_CHART_DATA.map(({seriesName, data}) =>
                AreaSeries({
                  name: seriesName,
                  data: data.map(({name, value}) => [name, value]),
                  lineStyle: {
                    color: '#444674',
                    opacity: 1,
                    width: 2,
                  },
                  areaStyle: {
                    color: '#444674',
                    opacity: 0.6,
                  },
                  smooth: true,
                  animation: false,
                  symbol: 'none',
                  emphasis: {
                    focus: 'series',
                    lineStyle: {
                      width: 3,
                    },
                  },
                })
              )} // the position of the chart
              grid={{
                top: 30,
                bottom: 30,
                left: 10,
                right: 10,
                borderColor: '#F0ECF3',
                borderWidth: 1,
              }}
              tooltip={computeChartTooltip(
                {
                  filter: (value: number) => value !== null,
                  valueFormatter: (value: number) => `${value}%`,
                  nameFormatter: () => 'Coverage',
                  formatter: (params: any) => {
                    const param = Array.isArray(params) ? params[0] : params;
                    const date = new Date(param.value[0]);
                    const formattedDate = date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: '2-digit',
                      year: 'numeric',
                    });

                    return `
                       <div style="background: #FFFFFF; border: 1px solid rgba(58, 17, 95, 0.14); border-radius: 6px; box-shadow: 0px 4px 24px rgba(43, 34, 51, 0.12); overflow: hidden; font-family: Rubik, sans-serif; width: 230.35px; position: relative;">
                         <div style="padding: 10px 16px;">
                           <div style="display: flex; align-items: center; gap: 8px;">
                             <div style="width: 10px; height: 10px; border-radius: 50%; background: #444674; flex-shrink: 0;"></div>
                             <div style="font-family: Rubik; font-size: 14px; font-weight: 400; line-height: 1.2; color: #3E3446; width: 62px;">Coverage</div>
                             <div style="font-family: Rubik; font-size: 14px; font-weight: 400; line-height: 1.2; color: #80708F; width: 42px; text-align: right;">${param.value[1]}%</div>
                           </div>
                         </div>
                         <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-top: 1px solid #E0DCE5; position: relative;">
                           <div style="font-family: Rubik; font-size: 14px; font-weight: 400; line-height: 1.2; color: #80708F; flex: 1;">
                             From commit d677638<br/>${formattedDate}, 00:00 (CEST)
                           </div>
                           <div style="width: 16px; height: 16px; color: #71637E; cursor: pointer; flex-shrink: 0;" onclick="window.open('https://github.com/commit/d677638', '_blank')">
                             <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                               <path d="M9 3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-2 0V5.414l-6.293 6.293a1 1 0 0 1-1.414-1.414L11.586 4H10a1 1 0 0 1-1-1z"/>
                             </svg>
                           </div>
                         </div>
                         <div style="position: absolute; bottom: -6px; left: 50%; transform: translateX(-50%); width: 16px; height: 6px;">
                           <div style="position: absolute; top: 0; left: 0; width: 16px; height: 5.1px; background: #FFFFFF;"></div>
                           <div style="position: absolute; top: 1px; left: 0; width: 16px; height: 5.07px; border: 1px solid rgba(58, 17, 95, 0.14); border-top: none; background: #FFFFFF;"></div>
                         </div>
                       </div>
                     `;
                  },
                },
                theme
              )}
              xAxis={{
                type: 'time',
                axisLine: {
                  show: true,
                  lineStyle: {
                    color: '#71637E',
                    width: 1,
                  },
                },
                axisTick: {
                  show: true,
                  length: 4,
                  lineStyle: {
                    color: '#71637E',
                    width: 1,
                  },
                },
                axisLabel: {
                  color: '#71637E',
                  fontSize: 12,
                  fontFamily: 'Rubik',
                  fontWeight: 400,
                  lineHeight: 1.33,
                  margin: 8,
                  formatter: (value: number) => {
                    const date = new Date(value);
                    return date.toLocaleDateString('en-US', {
                      month: 'short',
                      day: '2-digit',
                      year: 'numeric',
                    });
                  },
                },
                splitLine: {
                  show: false,
                },
              }}
              yAxis={{
                type: 'value',
                min: 'dataMin',
                max: 'dataMax',
                position: 'left',
                axisLine: {
                  show: false,
                },
                axisTick: {
                  show: false,
                },
                axisLabel: {
                  show: true,
                  color: '#71637E',
                  fontSize: 12,
                  fontFamily: 'Rubik',
                  fontWeight: 400,
                  lineHeight: 1.33,
                  margin: 8,
                  align: 'right',
                  verticalAlign: 'middle',
                  formatter: (value: number) => `${value}%`,
                },
                splitLine: {
                  show: false,
                },
              }}
            />
            <ChartTooltip>
              <TooltipContainer>
                <TooltipContent>
                  <TooltipItem>
                    <TooltipMarker />
                    <TooltipKey>Coverage</TooltipKey>
                    <TooltipValue>45%</TooltipValue>
                  </TooltipItem>
                </TooltipContent>
                <TooltipFooter>
                  <TooltipDate>
                    From commit d677638
                    <br />
                    Nov 24, 2025, 00:00 (CEST)
                  </TooltipDate>
                  <Tooltip title={t('Open in new tab')}>
                    <TooltipIcon
                      onClick={() =>
                        window.open('https://github.com/commit/d677638', '_blank')
                      }
                    >
                      <IconOpen size="xs" />
                    </TooltipIcon>
                  </Tooltip>
                </TooltipFooter>
                <TooltipCaret />
              </TooltipContainer>
            </ChartTooltip>
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

const StyledPanelHeader = styled(PanelHeader)`
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  font-size: 12px;
  font-weight: 500;
  color: ${p => p.theme.subText};
  text-transform: uppercase;
  padding: ${space(1.5)} ${space(2)};
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

const ChartContainer = styled('div')`
  position: relative;
  padding: ${space(2)};
`;

const ChartTooltip = styled('div')`
  position: absolute;
  top: 53px;
  left: 393px;
  z-index: 1000;
  pointer-events: none;
  display: none; /* Hidden by default, would be shown on hover */
`;

const TooltipContainer = styled('div')`
  background: #ffffff;
  border: 1px solid rgba(58, 17, 95, 0.14);
  border-radius: 6px;
  box-shadow: 0px 4px 24px rgba(43, 34, 51, 0.12);
  overflow: hidden;
  width: 230.35px;
`;

const TooltipContent = styled('div')`
  padding: 10px 16px;
`;

const TooltipItem = styled('div')`
  display: flex;
  align-items: center;
  gap: 8px;
  width: 129px;
`;

const TooltipMarker = styled('div')`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #444674;
  flex-shrink: 0;
`;

const TooltipKey = styled('div')`
  font-family: Rubik;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.2;
  color: #3e3446;
  width: 62px;
  text-align: left;
`;

const TooltipValue = styled('div')`
  font-family: Rubik;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.2;
  color: #80708f;
  width: 42px;
  text-align: right;
`;

const TooltipFooter = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-top: 1px solid #e0dce5;
  position: relative;
`;

const TooltipDate = styled('div')`
  font-family: Rubik;
  font-size: 14px;
  font-weight: 400;
  line-height: 1.2;
  color: #80708f;
  flex: 1;
`;

const TooltipIcon = styled('div')`
  width: 16px;
  height: 16px;
  color: #71637e;
  cursor: pointer;
  flex-shrink: 0;

  &:hover {
    color: #3e3446;
  }
`;

const TooltipCaret = styled('div')`
  position: absolute;
  bottom: -6px;
  left: 50%;
  transform: translateX(-50%);
  width: 16px;
  height: 6px;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    width: 16px;
    height: 5.1px;
    background: #ffffff;
  }

  &::after {
    content: '';
    position: absolute;
    top: 1px;
    left: 0;
    width: 16px;
    height: 5.07px;
    border: 1px solid rgba(58, 17, 95, 0.14);
    border-top: none;
    background: #ffffff;
  }
`;
