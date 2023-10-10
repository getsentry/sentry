import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatAbbreviatedNumber, getDuration} from 'sentry/utils/formatters';
import {ProjectScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {PERFORMANCE_SCORE_COLORS} from 'sentry/views/performance/browser/webVitals/utils/performanceScoreColors';
import {
  scoreToStatus,
  STATUS_TEXT,
} from 'sentry/views/performance/browser/webVitals/utils/scoreToStatus';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

type Props = {
  projectData: any;
  // TODO: type
  projectScore: ProjectScore;
  onClick?: (webVital: WebVitals) => void;
};

export default function WebVitalMeters({onClick, projectData, projectScore}: Props) {
  const getFormattedDuration = (value: number) => {
    return getDuration(value, value < 1 ? 0 : 2, true);
  };
  return (
    <Container>
      <Flex>
        <MeterBarContainer key="lcp" onClick={() => onClick?.('lcp')}>
          <MeterBarBody>
            <MeterHeader>{t('Largest Contentful Paint (P75)')}</MeterHeader>
            <MeterValueText>
              {getFormattedDuration(
                (projectData?.data?.[0]?.['p75(measurements.lcp)'] as number) / 1000
              )}
            </MeterValueText>
          </MeterBarBody>
          <MeterBarFooter score={projectScore.lcpScore} />
        </MeterBarContainer>
        <MeterBarContainer key="fcp" onClick={() => onClick?.('fcp')}>
          <MeterBarBody>
            <MeterHeader>{t('First Contentful Paint (P75)')}</MeterHeader>
            <MeterValueText>
              {getFormattedDuration(
                (projectData?.data?.[0]?.['p75(measurements.fcp)'] as number) / 1000
              )}
            </MeterValueText>
          </MeterBarBody>
          <MeterBarFooter score={projectScore.fcpScore} />
        </MeterBarContainer>
        <MeterBarContainer key="fid" onClick={() => onClick?.('fid')}>
          <MeterBarBody>
            <MeterHeader>{t('First Input Delay (P75)')}</MeterHeader>
            <MeterValueText>
              {getFormattedDuration(
                (projectData?.data?.[0]?.['p75(measurements.fid)'] as number) / 1000
              )}
            </MeterValueText>
          </MeterBarBody>
          <MeterBarFooter score={projectScore.fidScore} />
        </MeterBarContainer>
        <MeterBarContainer key="cls" onClick={() => onClick?.('cls')}>
          <MeterBarBody>
            <MeterHeader>{t('Cumulative Layout Shift (P75)')}</MeterHeader>
            <MeterValueText>
              {formatAbbreviatedNumber(
                projectData?.data?.[0]?.['p75(measurements.cls)'] as number,
                2
              )}
            </MeterValueText>
          </MeterBarBody>
          <MeterBarFooter score={projectScore.clsScore} />
        </MeterBarContainer>
        <MeterBarContainer key="ttfb" onClick={() => onClick?.('ttfb')}>
          <MeterBarBody>
            <MeterHeader>{t('Time To First Byte (P75)')}</MeterHeader>
            <MeterValueText>
              {getFormattedDuration(
                (projectData?.data?.[0]?.['p75(measurements.ttfb)'] as number) / 1000
              )}
            </MeterValueText>
          </MeterBarBody>
          <MeterBarFooter score={projectScore.ttfbScore} />
        </MeterBarContainer>
      </Flex>
    </Container>
  );
}

const Container = styled('div')`
  margin-top: ${space(2)};
  margin-bottom: ${space(1)};
`;

const Flex = styled('div')<{gap?: number}>`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  gap: ${p => (p.gap ? `${p.gap}px` : space(2))};
  align-items: center;
`;

const MeterBarContainer = styled('div')`
  flex: 1;
  top: -6px;
  position: relative;
  padding: 0;
  cursor: pointer;
  min-width: 200px;
`;

const MeterBarBody = styled('div')`
  border: 1px solid ${p => p.theme.gray200};
  border-radius: ${p => p.theme.borderRadius} ${p => p.theme.borderRadius} 0 0;
  border-bottom: none;
  padding: ${space(1)} 0 ${space(0.5)} 0;
`;

const MeterHeader = styled('div')`
  font-size: 13px;
  color: ${p => p.theme.textColor};
  font-weight: bold;
  display: inline-block;
  white-space: nowrap;
  text-align: center;
  width: 100%;
`;

const MeterValueText = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.textColor};
  flex: 1;
  text-align: center;
`;

function MeterBarFooter({score}: {score: number}) {
  const status = scoreToStatus(score);
  return (
    <MeterBarFooterContainer status={status}>
      {STATUS_TEXT[status]} {score}
    </MeterBarFooterContainer>
  );
}

const MeterBarFooterContainer = styled('div')<{status: string}>`
  color: ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].normal]};
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  background-color: ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].light]};
  border: solid 1px ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].normal]};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  padding: ${space(0.5)};
  text-align: center;
`;
