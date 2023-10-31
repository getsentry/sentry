import {useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {space} from 'sentry/styles/space';
import PerformanceScoreRing from 'sentry/views/performance/browser/webVitals/components/performanceScoreRing';
import {ProjectScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';

type Props = {
  onClick?: (webVital: WebVitals) => void;
  projectScore?: ProjectScore;
  transaction?: string;
};

export default function WebVitalRingMeters({onClick, projectScore}: Props) {
  const theme = useTheme();
  const [hoveredVital, setHoveredVital] = useState<WebVitals | null>(null);

  if (!projectScore) {
    return null;
  }

  const ringSegmentColors = theme.charts.getColorPalette(3);
  const ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);

  return (
    <Container>
      <Flex>
        <MeterBarContainer key="lcp">
          <WebVitalScoreRing
            backgroundColor={ringBackgroundColors[0]}
            color={ringSegmentColors[0]}
            score={projectScore.lcpScore}
            webVital="lcp"
            onClick={() => onClick?.('lcp')}
            onHover={() => setHoveredVital('lcp')}
            onUnhover={() => setHoveredVital(null)}
            unfocused={!!hoveredVital && hoveredVital !== 'lcp'}
          />
        </MeterBarContainer>
        <MeterBarContainer key="fcp">
          <WebVitalScoreRing
            backgroundColor={ringBackgroundColors[1]}
            color={ringSegmentColors[1]}
            score={projectScore.fcpScore}
            webVital="fcp"
            onClick={() => onClick?.('fcp')}
            onHover={() => setHoveredVital('fcp')}
            onUnhover={() => setHoveredVital(null)}
            unfocused={!!hoveredVital && hoveredVital !== 'fcp'}
          />
        </MeterBarContainer>
        <MeterBarContainer key="fid">
          <WebVitalScoreRing
            backgroundColor={ringBackgroundColors[2]}
            color={ringSegmentColors[2]}
            score={projectScore.fidScore}
            webVital="fid"
            onClick={() => onClick?.('fid')}
            onHover={() => setHoveredVital('fid')}
            onUnhover={() => setHoveredVital(null)}
            unfocused={!!hoveredVital && hoveredVital !== 'fid'}
          />
        </MeterBarContainer>
        <MeterBarContainer key="cls">
          <WebVitalScoreRing
            backgroundColor={ringBackgroundColors[3]}
            color={ringSegmentColors[3]}
            score={projectScore.clsScore}
            webVital="cls"
            onClick={() => onClick?.('cls')}
            onHover={() => setHoveredVital('cls')}
            onUnhover={() => setHoveredVital(null)}
            unfocused={!!hoveredVital && hoveredVital !== 'cls'}
          />
        </MeterBarContainer>
        <MeterBarContainer key="ttfb">
          <WebVitalScoreRing
            backgroundColor={ringBackgroundColors[4]}
            color={ringSegmentColors[4]}
            score={projectScore.ttfbScore}
            webVital="ttfb"
            onClick={() => onClick?.('ttfb')}
            onHover={() => setHoveredVital('ttfb')}
            onUnhover={() => setHoveredVital(null)}
            unfocused={!!hoveredVital && hoveredVital !== 'ttfb'}
          />
        </MeterBarContainer>
      </Flex>
    </Container>
  );
}

function WebVitalScoreRing({
  color,
  backgroundColor,
  score,
  webVital,
  onClick,
  onHover,
  unfocused,
  onUnhover,
}: {
  backgroundColor: string;
  color: string;
  score: number;
  webVital: WebVitals;
  onClick?: (webVital: WebVitals) => void;
  onHover?: () => void;
  onUnhover?: () => void;
  unfocused?: boolean;
}) {
  let segmentColor = color;
  let segmentBackgroundColor = backgroundColor;
  let textCss;
  if (unfocused) {
    segmentColor = `${color}60`;
    segmentBackgroundColor = `${backgroundColor.substring(0, 7)}30`;
    textCss = () => css`
      opacity: 0.3;
    `;
  }
  return (
    <Button
      onClick={() => onClick?.(webVital)}
      priority="link"
      onMouseOver={onHover}
      onMouseLeave={onUnhover}
    >
      <svg height={100} width={100}>
        <PerformanceScoreRing
          backgroundColors={[segmentBackgroundColor]}
          maxValues={[100]}
          segmentColors={[segmentColor]}
          text={
            <TextContainer>
              <ScoreText>{score}</ScoreText>
              <WebVitalText>{webVital.toUpperCase()}</WebVitalText>
            </TextContainer>
          }
          values={[score]}
          size={100}
          barWidth={14}
          textCss={textCss}
        />
      </svg>
    </Button>
  );
}

const TextContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const ScoreText = styled('div')`
  font-size: ${space(3)};
  font-weight: bold;
  color: ${p => p.theme.textColor};
`;

const WebVitalText = styled('div')`
  font-size: ${space(1.5)};
  font-weight: bold;
  color: ${p => p.theme.textColor};
`;

const Container = styled('div')`
  margin: 48px 0;
`;

const Flex = styled('div')<{gap?: number}>`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  width: 100%;
  align-items: center;
`;

const MeterBarContainer = styled('div')`
  flex: 1;
  top: -6px;
  position: relative;
  padding: ${space(1)} 0;
  width: 100px;
  justify-content: center;
  display: flex;
`;
