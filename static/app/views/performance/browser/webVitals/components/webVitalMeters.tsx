import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {formatAbbreviatedNumber, getDuration} from 'sentry/utils/formatters';
import {
  PerformanceBadge,
  scoreToStatus,
} from 'sentry/views/performance/browser/webVitals/components/performanceBadge';
import {ProjectScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

type Props = {
  projectData: any;
  // TODO: type
  projectScore: ProjectScore;
  onClick?: (webVital: WebVitals) => void;
};

export default function WebVitalMeters({onClick, projectData, projectScore}: Props) {
  const theme = useTheme();
  const colors = theme.charts.getColorPalette(3);
  const betterGetDuration = (value: number) => {
    return getDuration(value, value < 1000 ? 0 : 2, true);
  };
  return (
    <Container>
      <Flex>
        <MeterBarContainer key="lcp" onClick={() => onClick?.('lcp')}>
          <Flex>
            <MeterHeader>Largest Contentful Paint</MeterHeader>
            <PerformanceBadge status={scoreToStatus(projectScore.lcpScore)} />
          </Flex>
          <Flex>
            <LegendDot color={colors[0]} />
            <MeterValueText>
              {betterGetDuration(
                (projectData?.data?.[0]?.['p75(measurements.lcp)'] as number) / 1000
              )}
            </MeterValueText>
          </Flex>
        </MeterBarContainer>
        <MeterBarContainer key="fcp" onClick={() => onClick?.('fcp')}>
          <Flex>
            <MeterHeader>First Contentful Paint</MeterHeader>
            <PerformanceBadge status={scoreToStatus(projectScore.fcpScore)} />
          </Flex>
          <Flex>
            <LegendDot color={colors[1]} />
            <MeterValueText>
              {betterGetDuration(
                (projectData?.data?.[0]?.['p75(measurements.fcp)'] as number) / 1000
              )}
            </MeterValueText>
          </Flex>
        </MeterBarContainer>
        <MeterBarContainer key="fid" onClick={() => onClick?.('fid')}>
          <Flex>
            <MeterHeader>First Input Delay</MeterHeader>
            <PerformanceBadge status={scoreToStatus(projectScore.fidScore)} />
          </Flex>
          <Flex>
            <LegendDot color={colors[2]} />
            <MeterValueText>
              {betterGetDuration(
                (projectData?.data?.[0]?.['p75(measurements.fid)'] as number) / 1000
              )}
            </MeterValueText>
          </Flex>
        </MeterBarContainer>
        <MeterBarContainer key="cls" onClick={() => onClick?.('cls')}>
          <Flex>
            <MeterHeader>Cumulative Layout Shift</MeterHeader>
            <PerformanceBadge status={scoreToStatus(projectScore.clsScore)} />
          </Flex>
          <Flex>
            <LegendDot color={colors[3]} />
            <MeterValueText>
              {formatAbbreviatedNumber(
                projectData?.data?.[0]?.['p75(measurements.cls)'] as number,
                2
              )}
            </MeterValueText>
          </Flex>
        </MeterBarContainer>
        <MeterBarContainer key="ttfb" onClick={() => onClick?.('ttfb')}>
          <Flex>
            <MeterHeader>Time To First Byte</MeterHeader>
            <PerformanceBadge status={scoreToStatus(projectScore.ttfbScore)} />
          </Flex>
          <Flex>
            <LegendDot color={colors[4]} />
            <MeterValueText>
              {betterGetDuration(
                (projectData?.data?.[0]?.['p75(measurements.ttfb)'] as number) / 1000
              )}
            </MeterValueText>
          </Flex>
        </MeterBarContainer>
      </Flex>
    </Container>
  );
}

const Container = styled('div')`
  margin-top: ${space(2)};
`;

const Flex = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  gap: ${space(2)};
  align-items: center;
`;

const MeterBarContainer = styled('div')`
  flex: 1;
  top: -6px;
  position: relative;
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1.5)};
  cursor: pointer;
  min-width: 200px;
`;

const MeterHeader = styled('div')`
  font-size: 13px;
  color: ${p => p.theme.textColor};
  font-weight: bold;
  display: inline-block;
`;

const LegendDot = styled('span')<{color: string}>`
  padding: 0;
  position: relative;
  width: 10px;
  height: 10px;
  text-indent: -9999em;
  display: inline-block;
  border-radius: 50%;
  flex-shrink: 0;
  background-color: ${p => p.color};
`;

const MeterValueText = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.textColor};
  flex: 1;
`;
