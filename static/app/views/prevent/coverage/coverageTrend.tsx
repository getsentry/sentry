import {Fragment, useCallback, useEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {AreaChart} from 'sentry/components/charts/areaChart';
import {ChartContainer, HeaderTitleLegend} from 'sentry/components/charts/styles';
import {Tag} from 'sentry/components/core/badge/tag';
import {Checkbox} from 'sentry/components/core/checkbox';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {
  IconCalendar,
  IconCheckmark,
  IconChevron,
  IconClose,
  IconTelescope,
} from 'sentry/icons';
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

const TARGET_COVERAGE = 80;

// Fun facts about code coverage to motivate users
const COVERAGE_FACTS = [
  {
    id: 1,
    title: 'Did you know?',
    fact: 'Teams with 80%+ code coverage catch 3x more bugs before deployment',
    emoji: '🐛',
    category: 'Bug Prevention',
  },
  {
    id: 2,
    title: 'Fun Fact',
    fact: 'Code coverage can reduce production incidents by up to 60%',
    emoji: '🚀',
    category: 'Production Quality',
  },
  {
    id: 3,
    title: 'Pro Tip',
    fact: 'Writing tests first (TDD) naturally increases coverage and code quality',
    emoji: '🧪',
    category: 'Best Practice',
  },
  {
    id: 4,
    title: 'Interesting!',
    fact: 'High coverage teams ship features 40% faster due to fewer rollbacks',
    emoji: '⚡',
    category: 'Development Speed',
  },
  {
    id: 5,
    title: 'Coverage Wisdom',
    fact: 'The sweet spot for most teams is 80-90% coverage - beyond that has diminishing returns',
    emoji: '🎯',
    category: 'Strategy',
  },
  {
    id: 6,
    title: 'Team Boost',
    fact: 'Teams with good test coverage report 50% more confidence in deployments',
    emoji: '💪',
    category: 'Team Confidence',
  },
];

function CoverageFactsCards() {
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [swipeDirection, setSwipeDirection] = useState<'left' | 'right' | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({x: 0, y: 0});
  const [startPos, setStartPos] = useState({x: 0, y: 0});

  const currentCard = COVERAGE_FACTS[currentCardIndex];

  const handleSwipe = useCallback(
    (direction: 'left' | 'right') => {
      if (isAnimating || !currentCard) return;

      setIsAnimating(true);
      setSwipeDirection(direction);

      setTimeout(() => {
        setCurrentCardIndex(prev => (prev + 1) % COVERAGE_FACTS.length);
        setIsAnimating(false);
        setSwipeDirection(null);
      }, 300);
    },
    [isAnimating, currentCard]
  );

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      handleSwipe('left');
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      handleSwipe('right');
    }
  };

  const handleDragStart = (event: React.MouseEvent | React.TouchEvent) => {
    if (isAnimating) return;

    setIsDragging(true);
    const clientX = 'touches' in event ? (event.touches[0]?.clientX ?? 0) : event.clientX;
    const clientY = 'touches' in event ? (event.touches[0]?.clientY ?? 0) : event.clientY;
    setStartPos({x: clientX, y: clientY});
    setDragOffset({x: 0, y: 0});
  };

  const handleDragMove = useCallback(
    (event: React.MouseEvent | React.TouchEvent) => {
      if (!isDragging) return;

      event.preventDefault();
      const touch = 'touches' in event ? event.touches[0] : null;
      const clientX = touch ? touch.clientX : (event as React.MouseEvent).clientX;
      const clientY = touch ? touch.clientY : (event as React.MouseEvent).clientY;

      const deltaX = clientX - startPos.x;
      const deltaY = clientY - startPos.y;

      setDragOffset({x: deltaX, y: deltaY});
    },
    [isDragging, startPos.x, startPos.y]
  );

  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;

    setIsDragging(false);

    const threshold = 80; // pixels to trigger swipe
    const absX = Math.abs(dragOffset.x);

    if (absX > threshold) {
      if (dragOffset.x > 0) {
        handleSwipe('right'); // dragged right = like
      } else {
        handleSwipe('left'); // dragged left = dismiss
      }
    }

    // Reset drag offset
    setDragOffset({x: 0, y: 0});
  }, [isDragging, dragOffset.x, handleSwipe]);

  // Add global event listeners for drag
  useEffect(() => {
    const handleGlobalMouseMove = (event: MouseEvent) => {
      if (!isDragging) return;
      handleDragMove(event as any);
    };

    const handleGlobalMouseUp = () => {
      if (isDragging) {
        handleDragEnd();
      }
    };

    const handleGlobalTouchMove = (event: TouchEvent) => {
      if (!isDragging) return;
      handleDragMove(event as any);
    };

    const handleGlobalTouchEnd = () => {
      if (isDragging) {
        handleDragEnd();
      }
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('touchmove', handleGlobalTouchMove);
      document.addEventListener('touchend', handleGlobalTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchmove', handleGlobalTouchMove);
      document.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, [isDragging, handleDragMove, handleDragEnd]);

  if (!currentCard) {
    return null;
  }

  return (
    <FactsCardContainer onKeyDown={handleKeyPress} tabIndex={0}>
      <FactsHeader>
        <IconTelescope size="sm" />
        <FactsTitle>{t('Coverage Fun Facts')}</FactsTitle>
      </FactsHeader>

      <CardStack>
        <FactCard
          isAnimating={isAnimating}
          swipeDirection={swipeDirection}
          isDragging={isDragging}
          dragOffset={dragOffset}
          onMouseDown={handleDragStart}
          onTouchStart={handleDragStart}
        >
          <CardCategory>{currentCard.category}</CardCategory>
          <CardEmoji>{currentCard.emoji}</CardEmoji>
          <CardTitle>{currentCard.title}</CardTitle>
          <CardFact>{currentCard.fact}</CardFact>
        </FactCard>

        <CardActions>
          <ActionButton
            variant="dismiss"
            onClick={() => handleSwipe('left')}
            role="button"
            aria-label={t('Dismiss fact (Left arrow key or drag left)')}
          >
            <IconClose size="sm" />
          </ActionButton>

          <CardCounter>
            {currentCardIndex + 1} / {COVERAGE_FACTS.length}
          </CardCounter>

          <ActionButton
            variant="like"
            onClick={() => handleSwipe('right')}
            role="button"
            aria-label={t('Like fact (Right arrow key or drag right)')}
          >
            <IconCheckmark size="sm" />
          </ActionButton>
        </CardActions>
      </CardStack>
    </FactsCardContainer>
  );
}

export default function CoverageTrendPage() {
  const theme = useTheme();
  const [showTargetLine, setShowTargetLine] = useState(true);

  return (
    <Fragment>
      <PageHeader>
        <HeaderTitle>
          {t('Coverage based on the selected branch: Main branch')}
        </HeaderTitle>
        <HeaderControls>
          <TargetToggle>
            <Checkbox
              checked={showTargetLine}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setShowTargetLine(e.target.checked)
              }
            />
            <TargetLabel>{t('Show Target (80%)')}</TargetLabel>
          </TargetToggle>
          <TimeRangeSelector>
            <IconCalendar size="sm" />
            <span>30D</span>
            <IconChevron direction="down" size="xs" />
          </TimeRangeSelector>
        </HeaderControls>
      </PageHeader>

      <MainLayout>
        <LeftColumn>
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

          <CoverageFactsCards />
        </LeftColumn>

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
                    additionalSeries={
                      showTargetLine
                        ? [
                            {
                              type: 'line' as const,
                              name: t('Target'),
                              data: SAMPLE_CHART_DATA.map(({name}) => [
                                name,
                                TARGET_COVERAGE,
                              ]),
                              lineStyle: {
                                color: theme.red300,
                                type: 'dashed',
                                width: 2,
                              },
                              itemStyle: {
                                color: theme.red300,
                              },
                              symbol: 'none',
                              markLine: {
                                silent: true,
                                lineStyle: {
                                  color: theme.red300,
                                  type: 'dashed',
                                  width: 2,
                                },
                                data: [
                                  {
                                    yAxis: TARGET_COVERAGE,
                                    label: {
                                      show: true,
                                      position: 'end',
                                      formatter: `Target ${TARGET_COVERAGE}%`,
                                      color: theme.red300,
                                    },
                                  },
                                ],
                              },
                            },
                          ]
                        : []
                    }
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

const HeaderControls = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(3)};
`;

const TargetToggle = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const TargetLabel = styled('label')`
  font-size: 14px;
  font-weight: 500;
  color: ${p => p.theme.textColor};
  cursor: pointer;
  user-select: none;
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

const LeftColumn = styled('div')`
  display: flex;
  flex-direction: column;
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

// Tinder Cards Styled Components
const FactsCardContainer = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px ${p => p.theme.purple100};
  }
`;

const FactsHeader = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding: ${space(2)} ${space(3)};
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const FactsTitle = styled('h3')`
  font-size: 14px;
  font-weight: 600;
  color: ${p => p.theme.textColor};
  margin: 0;
`;

const CardStack = styled('div')`
  position: relative;
  height: 200px;
  padding: ${space(3)};
  margin: 10px;
`;

const FactCard = styled('div')<{
  dragOffset: {x: number; y: number};
  isAnimating: boolean;
  isDragging: boolean;
  swipeDirection: 'left' | 'right' | null;
}>`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  background: linear-gradient(
    135deg,
    ${p => p.theme.purple100} 0%,
    ${p => p.theme.blue100} 100%
  );
  border: 1px solid ${p => p.theme.purple200};
  border-radius: 12px;
  padding: ${space(3)};
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  min-height: 140px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  cursor: grab;
  user-select: none;
  transition: ${p =>
    p.isDragging ? 'none' : 'all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)'};

  ${p => {
    if (p.isAnimating && p.swipeDirection === 'left') {
      return `
        transform: translateX(-100%) rotate(-10deg);
        opacity: 0;
      `;
    }
    if (p.isAnimating && p.swipeDirection === 'right') {
      return `
        transform: translateX(100%) rotate(10deg);
        opacity: 0;
      `;
    }
    if (p.isDragging) {
      const rotation = p.dragOffset.x * 0.1; // subtle rotation based on drag
      const opacity = Math.max(0.7, 1 - Math.abs(p.dragOffset.x) / 200);
      return `
        transform: translate(${p.dragOffset.x}px, ${p.dragOffset.y}px) rotate(${rotation}deg);
        opacity: ${opacity};
        cursor: grabbing;
        z-index: 10;
      `;
    }
    return '';
  }}

  &:hover {
    ${p =>
      !p.isDragging &&
      !p.isAnimating &&
      `
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    `}
  }

  &:active {
    cursor: grabbing;
  }
`;

const CardCategory = styled('div')`
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: ${p => p.theme.purple400};
  margin-bottom: ${space(1)};
`;

const CardEmoji = styled('div')`
  font-size: 32px;
  margin-bottom: ${space(1.5)};
  line-height: 1;
`;

const CardTitle = styled('h4')`
  font-size: 16px;
  font-weight: 600;
  color: ${p => p.theme.textColor};
  margin: 0 0 ${space(1.5)} 0;
`;

const CardFact = styled('p')`
  font-size: 13px;
  line-height: 1.4;
  color: ${p => p.theme.subText};
  margin: 0;
  max-width: 250px;
`;

const CardActions = styled('div')`
  position: absolute;
  bottom: 10px;
  left: ${space(3)};
  right: ${space(3)};
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const ActionButton = styled('button')<{variant: 'like' | 'dismiss'}>`
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid;
  background: ${p => p.theme.background};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;

  ${p =>
    p.variant === 'like' &&
    `
    border-color: ${p.theme.green300};
    color: ${p.theme.green400};

    &:hover {
      background: ${p.theme.green100};
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }
  `}

  ${p =>
    p.variant === 'dismiss' &&
    `
    border-color: ${p.theme.red300};
    color: ${p.theme.red400};

    &:hover {
      background: ${p.theme.red100};
      transform: scale(1.1);
    }

    &:active {
      transform: scale(0.95);
    }
  `}

  &:focus {
    outline: none;
    box-shadow: 0 0 0 3px ${p => p.theme.purple100};
  }
`;

const CardCounter = styled('div')`
  font-size: 12px;
  font-weight: 500;
  color: ${p => p.theme.subText};
  background: ${p => p.theme.background};
  padding: ${space(0.5)} ${space(1)};
  border-radius: 12px;
  border: 1px solid ${p => p.theme.border};
`;
