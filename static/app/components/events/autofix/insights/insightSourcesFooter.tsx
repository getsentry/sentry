import React, {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {useUpdateInsightCard} from 'sentry/components/events/autofix/hooks/useUpdateInsightCard';
import {
  generateSourceCards,
  SourceCard,
} from 'sentry/components/events/autofix/insights/autofixInsightSources';
import type {AutofixInsight} from 'sentry/components/events/autofix/types';
import {
  deduplicateSourcesAndUpdateInsights,
  getExpandedInsightSources,
} from 'sentry/components/events/autofix/utils/insightUtils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import {cardAnimationProps, FlippedReturnIcon} from './autofixInsightCard';

interface InsightSourcesFooterProps {
  expandedCardIndex: number | null;
  groupId: string;
  insights: AutofixInsight[];
  runId: string;
  stepIndex: number;
}

export function InsightSourcesFooter({
  insights,
  expandedCardIndex,
  stepIndex,
  groupId,
  runId,
}: InsightSourcesFooterProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [newInsightText, setNewInsightText] = useState('');
  const {mutate: updateInsight} = useUpdateInsightCard({groupId, runId});
  const organization = useOrganization();

  const {deduplicatedSources, updatedInsights} = useMemo(
    () => deduplicateSourcesAndUpdateInsights(insights),
    [insights]
  );

  const expandedSources = useMemo(
    () => getExpandedInsightSources(updatedInsights, expandedCardIndex),
    [updatedInsights, expandedCardIndex]
  );

  const sourceCards = useMemo(
    () => generateSourceCards(deduplicatedSources, undefined, {location, navigate}),
    [deduplicatedSources, location, navigate]
  );

  const expandedCards = useMemo(
    () =>
      expandedSources
        ? generateSourceCards(expandedSources, undefined, {location, navigate})
        : [],
    [expandedSources, location, navigate]
  );

  const renderedSourceCards = useMemo(
    () =>
      sourceCards.map(sourceCard => {
        // Check if this source should be primary (expanded insight contains it)
        const shouldBePrimary = expandedCards.some(
          expandedCard => expandedCard.key === sourceCard.key
        );

        return (
          <motion.div
            key={sourceCard.key}
            {...cardAnimationProps}
            transition={{
              ...cardAnimationProps.transition,
              delay: 0.1 * Math.min(sourceCards.indexOf(sourceCard), 5), // Stagger animations
            }}
          >
            <SourceCard
              size="xs"
              priority={shouldBePrimary ? 'primary' : 'default'}
              onClick={sourceCard.onClick}
              icon={sourceCard.icon}
              isHighlighted={shouldBePrimary}
            >
              {sourceCard.label}
            </SourceCard>
          </motion.div>
        );
      }),
    [sourceCards, expandedCards]
  );

  if (insights.length === 0) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newInsightText.trim()) return;

    updateInsight({
      message: newInsightText,
      step_index: stepIndex,
      retain_insight_card_index: insights.length > 0 ? insights.length : null,
    });
    setNewInsightText('');

    trackAnalytics('autofix.step.rethink', {
      step_index: stepIndex,
      group_id: groupId,
      run_id: runId,
      organization,
    });
  };

  return (
    <React.Fragment>
      <BottomDivider />
      <FooterContainer>
        <FooterContent>
          <SourcesContainer>{renderedSourceCards}</SourcesContainer>
          <FooterInputContainer>
            <FooterInputWrapper onSubmit={handleSubmit}>
              <FooterInput
                type="text"
                value={newInsightText}
                onChange={e => setNewInsightText(e.target.value)}
                maxLength={4096}
                placeholder={t('Rethink this answer...')}
                size="xs"
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  }
                }}
              />
              <FooterSubmitButton
                type="submit"
                size="zero"
                borderless
                title={t('Give feedback and rethink the answer')}
                disabled={!newInsightText.trim()}
              >
                <FlippedReturnIcon />
              </FooterSubmitButton>
            </FooterInputWrapper>
          </FooterInputContainer>
        </FooterContent>
      </FooterContainer>
    </React.Fragment>
  );
}

// Styled Components
const BottomDivider = styled('div')`
  margin-top: ${p => p.theme.space.lg};
  border-top: 1px solid ${p => p.theme.tokens.border.secondary};
`;

const FooterContainer = styled('div')`
  display: flex;
  justify-content: space-between;
  padding-top: ${p => p.theme.space.xl};
  padding-bottom: ${p => p.theme.space.md};
`;

const SourcesContainer = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${p => p.theme.space.xs};
  width: 75%;
  max-width: 75%;
  align-self: flex-start;
  justify-content: flex-start;
  min-width: 0;
`;

const FooterContent = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.md};
  width: 100%;
  align-items: stretch;
  justify-content: flex-start;
`;

const FooterInputContainer = styled('div')`
  width: 50%;
  max-width: 250px;
  align-self: flex-end;
`;

const FooterInputWrapper = styled('form')`
  display: flex;
  position: relative;
  border-radius: ${p => p.theme.radius.md};
`;

const FooterInput = styled(Input)`
  padding-right: ${space(4)};
`;

const FooterSubmitButton = styled(Button)`
  position: absolute;
  right: ${space(1)};
  top: 50%;
  transform: translateY(-50%);
  height: 24px;
  width: 24px;
  border-radius: 5px;
`;
