import {Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import type {AutofixInsight} from 'sentry/components/events/autofix/types';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import {AutofixInsightCard} from './autofixInsightCard';
import {CollapsibleChainLink} from './collapsibleChainLink';
import {InsightSourcesFooter} from './insightSourcesFooter';

interface AutofixInsightCardsProps {
  groupId: string;
  hasStepBelow: boolean;
  insights: AutofixInsight[];
  runId: string;
  stepIndex: number;
  shouldCollapseByDefault?: boolean;
}

function AutofixInsightCardsDisplay({
  insights,
  hasStepBelow,
  stepIndex,
  groupId,
  runId,
}: AutofixInsightCardsProps) {
  const [expandedCardIndex, setExpandedCardIndex] = useState<number | null>(null);
  const previousInsightsRef = useRef<AutofixInsight[]>([]);
  const [newInsightIndices, setNewInsightIndices] = useState<number[]>([]);
  const hasMounted = useRef(false);

  useEffect(() => {
    hasMounted.current = true;
  }, []);

  // Compare current insights with previous insights to determine which ones are new
  useEffect(() => {
    if (insights.length === previousInsightsRef.current.length + 1) {
      // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
      setNewInsightIndices([insights.length - 1]);
    } else {
      setNewInsightIndices([]);
    }
    previousInsightsRef.current = [...insights];
  }, [insights]);

  const handleToggleExpand = (index: number | null) => {
    setExpandedCardIndex(prevIndex => (prevIndex === index ? null : index));
  };

  const validInsightCount = insights.filter(insight => insight).length;

  return (
    <InsightsContainerWithLines>
      <VerticalLine />
      {insights.length > 0 ? (
        <InsightsCardContainer>
          <HeaderWrapper>
            <HeaderText>{t('Reasoning')}</HeaderText>
          </HeaderWrapper>
          <Content>
            <Fragment>
              <AnimatePresence initial={hasMounted.current}>
                <motion.div
                  initial={{height: 0, opacity: 0}}
                  animate={{height: 'auto', opacity: 1}}
                  exit={{height: 0, opacity: 0}}
                  transition={{duration: 0.2}}
                >
                  <CardsStack>
                    {insights.map((insight, index) =>
                      insight ? (
                        <AutofixInsightCard
                          key={index}
                          insight={insight}
                          index={index}
                          stepIndex={stepIndex}
                          groupId={groupId}
                          runId={runId}
                          isNewInsight={newInsightIndices.includes(index)}
                          isExpanded={expandedCardIndex === index}
                          onToggleExpand={handleToggleExpand}
                        />
                      ) : null
                    )}
                  </CardsStack>
                </motion.div>
              </AnimatePresence>
            </Fragment>
            <InsightSourcesFooter
              insights={insights}
              expandedCardIndex={expandedCardIndex}
              stepIndex={stepIndex}
              groupId={groupId}
              runId={runId}
            />
          </Content>
        </InsightsCardContainer>
      ) : (
        // When no insights, show only vertical line and add button (no container)
        <Fragment>
          {stepIndex === 0 && !hasStepBelow ? (
            <NoInsightsYet />
          ) : (
            hasStepBelow && (
              <CollapsibleChainLink
                isEmpty={false}
                stepIndex={stepIndex}
                groupId={groupId}
                runId={runId}
                insightCount={validInsightCount}
                showAddControl
              />
            )
          )}
        </Fragment>
      )}
      {hasStepBelow && <VerticalLine />}
    </InsightsContainerWithLines>
  );
}

export default function AutofixInsightCards(props: AutofixInsightCardsProps) {
  return <AutofixInsightCardsDisplay {...props} />;
}

const HeaderWrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
`;

const HeaderText = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.lg};
  color: ${p => p.theme.tokens.content.secondary};
`;

const NoInsightsYet = styled('div')`
  display: flex;
  justify-content: center;
  flex-direction: column;
  color: ${p => p.theme.tokens.content.secondary};
`;

const InsightsContainerWithLines = styled('div')`
  display: flex;
  flex-direction: column;
  position: relative;
  margin-left: ${p => p.theme.space.xl};
  margin-right: ${p => p.theme.space.xl};
`;

const VerticalLine = styled('div')`
  width: 1px;
  height: ${p => p.theme.space.xl};
  background-color: ${p => p.theme.tokens.border.primary};
  margin-left: 16px;
`;

const CardsStack = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 0;
`;

const InsightsCardContainer = styled('div')`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  overflow: hidden;
  box-shadow: ${p => p.theme.dropShadowMedium};
  padding: ${p => p.theme.space.lg};
  background: ${p => p.theme.tokens.background.primary};
  width: 100%;
  padding-bottom: 0;
`;

const Content = styled('div')`
  padding: ${space(1)} 0;
`;
