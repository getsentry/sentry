import {useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {addErrorMessage, addLoadingMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {AutofixHighlightWrapper} from 'sentry/components/events/autofix/autofixHighlightWrapper';
import AutofixInsightSources from 'sentry/components/events/autofix/autofixInsightSources';
import {replaceHeadersWithBold} from 'sentry/components/events/autofix/autofixRootCause';
import {ModalWithFeedback} from 'sentry/components/events/autofix/modalWithFeedback';
import type {AutofixInsight} from 'sentry/components/events/autofix/types';
import {makeAutofixQueryKey} from 'sentry/components/events/autofix/useAutofix';
import {useTypingAnimation} from 'sentry/components/events/autofix/useTypingAnimation';
import {ScrollCarousel} from 'sentry/components/scrollCarousel';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

export function useUpdateInsightCard({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const orgSlug = useOrganization().slug;

  return useMutation({
    mutationFn: (params: {
      message: string;
      retain_insight_card_index: number | null;
      step_index: number;
    }) => {
      return api.requestPromise(
        `/organizations/${orgSlug}/issues/${groupId}/autofix/update/`,
        {
          method: 'POST',
          data: {
            run_id: runId,
            payload: {
              type: 'restart_from_point_with_feedback',
              message: params.message.trim(),
              step_index: params.step_index,
              retain_insight_card_index: params.retain_insight_card_index,
            },
          },
        }
      );
    },
    onSuccess: _ => {
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(orgSlug, groupId, true),
      });
      queryClient.invalidateQueries({
        queryKey: makeAutofixQueryKey(orgSlug, groupId, false),
      });
      addLoadingMessage(t('Rethinking this...'));
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when sending Seer your message.'));
    },
  });
}

interface AutofixInsightCardProps {
  groupId: string;
  index: number;
  insight: AutofixInsight;
  isNewInsight: boolean | undefined;
  runId: string;
  stepIndex: number;
}

function AutofixInsightCard({
  insight,
  index,
  stepIndex,
  groupId,
  runId,
  isNewInsight,
}: AutofixInsightCardProps) {
  const isUserMessage = insight.justification === 'USER';
  const displayedInsightTitle = useTypingAnimation({
    text: insight.insight,
    enabled: !!isNewInsight,
    speed: 70,
  });

  const toggleExpand = () => {
    openModal(({Header, Body, Footer, CloseButton}) => (
      <ModalWithFeedback
        insight={insight}
        groupId={groupId}
        runId={runId}
        stepIndex={stepIndex}
        insightCardAboveIndex={insightCardAboveIndex}
        titleHtml={titleHtml}
        hasFullJustification={hasFullJustification}
        fullJustificationText={fullJustificationText}
        Header={Header}
        Body={Body}
        Footer={Footer}
        CloseButton={CloseButton}
      />
    ));
  };

  const insightCardAboveIndex = index - 1 >= 0 ? index - 1 : null;

  const titleHtml = useMemo(() => {
    return {
      __html: singleLineRenderer(displayedInsightTitle),
    };
  }, [displayedInsightTitle]);

  const hasFullJustification = !isUserMessage && !!insight.justification;

  const fullJustificationText = useMemo(() => {
    const fullJustification = isUserMessage ? '' : insight.justification;
    return replaceHeadersWithBold(fullJustification || t('No details here.'));
  }, [isUserMessage, insight.justification]);

  return (
    <InsightCard
      data-new-insight={isNewInsight ? 'true' : 'false'}
      onClick={toggleExpand}
      initial={isNewInsight ? {opacity: 0, y: -24} : false}
      animate={isNewInsight ? {opacity: 1, y: 0} : {}}
      transition={{duration: 0.2, ease: 'easeInOut'}}
    >
      <AutofixHighlightWrapper
        groupId={groupId}
        runId={runId}
        stepIndex={stepIndex}
        retainInsightCardIndex={insightCardAboveIndex}
      >
        <CardTitle dangerouslySetInnerHTML={titleHtml} />
      </AutofixHighlightWrapper>

      {insight.sources && (
        <CardSources onClick={e => e.stopPropagation()}>
          <AutofixInsightSources
            sources={insight.sources}
            title={insight.insight}
            textColor="subText"
            size="zero"
            alignment="right"
          />
        </CardSources>
      )}
    </InsightCard>
  );
}

interface AutofixInsightCardsProps {
  groupId: string;
  hasStepAbove: boolean;
  hasStepBelow: boolean;
  insights: AutofixInsight[];
  runId: string;
  stepIndex: number;
  shouldCollapseByDefault?: boolean;
}

function AutofixInsightCards({
  insights,
  hasStepBelow,
  stepIndex,
  groupId,
  runId,
}: Omit<AutofixInsightCardsProps, 'hasStepAbove' | 'shouldCollapseByDefault'>) {
  const previousInsightsRef = useRef<AutofixInsight[]>([]);
  const [newInsightIndices, setNewInsightIndices] = useState<number[]>([]);
  const hasMounted = useRef(false);
  const carouselRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    hasMounted.current = true;
  }, []);

  // Compare current insights with previous insights to determine which ones are new
  useEffect(() => {
    if (insights.length === previousInsightsRef.current.length + 1) {
      setNewInsightIndices([insights.length - 1]);
    } else {
      setNewInsightIndices([]);
    }
    previousInsightsRef.current = [...insights];
  }, [insights]);

  // Auto-scroll to the right when new insights are added
  useEffect(() => {
    if (newInsightIndices.length > 0 && carouselRef.current && hasMounted.current) {
      const timeoutId = setTimeout(() => {
        const scrollContainer = carouselRef.current?.querySelector(
          '[role="group"]'
        ) as HTMLDivElement;
        if (scrollContainer) {
          scrollContainer.scrollTo({
            left: scrollContainer.scrollWidth,
            behavior: 'smooth',
          });
        }
      }, 100);

      return () => clearTimeout(timeoutId);
    }

    return undefined;
  }, [newInsightIndices]);

  const validInsights = insights.filter(insight => insight);

  if (validInsights.length === 0) {
    return stepIndex === 0 && !hasStepBelow ? <NoInsightsYet /> : null;
  }

  const cardsWithArrows = validInsights.reduce<React.ReactNode[]>(
    (acc, insight, index) => {
      acc.push(
        <AutofixInsightCard
          key={index}
          insight={insight}
          index={index}
          stepIndex={stepIndex}
          groupId={groupId}
          runId={runId}
          isNewInsight={newInsightIndices.includes(index)}
        />
      );

      // Add arrow separator between cards (but not after the last one)
      if (index < validInsights.length - 1) {
        acc.push(
          <ArrowSeparator key={`arrow-${index}`}>
            <IconArrow direction="right" size="sm" />
          </ArrowSeparator>
        );
      }

      return acc;
    },
    []
  );

  return (
    <InsightsSection>
      <TopArrowContainer>
        <VerticalLine />
      </TopArrowContainer>
      <CarouselContainer ref={carouselRef}>
        <ScrollCarousel aria-label="Insight cards" gap={1}>
          {cardsWithArrows}
        </ScrollCarousel>
      </CarouselContainer>
      {hasStepBelow && (
        <BottomArrowContainer>
          <VerticalLine />
        </BottomArrowContainer>
      )}
    </InsightsSection>
  );
}

const VerticalLine = styled('div')`
  width: 0;
  height: ${p => p.theme.space['2xl']};
  border-left: 1px solid ${p => p.theme.border};
`;

const InsightsSection = styled('div')`
  display: flex;
  flex-direction: column;
`;

const TopArrowContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  margin-left: ${p => p.theme.space.xl};
`;

const BottomArrowContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-end;
  margin-right: ${p => p.theme.space.xl};
`;

const CarouselContainer = styled('div')`
  width: 100%;
  overflow: hidden;
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
  box-shadow: ${p => p.theme.dropShadowMedium};
  background: ${p => p.theme.background};
  padding: ${p => p.theme.space.md};
`;

const CardSources = styled('div')`
  margin-top: ${p => p.theme.space.xl};
`;

const ArrowSeparator = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: ${p => p.theme.subText};
`;

const InsightCard = styled(motion.div)`
  width: 250px;
  flex-shrink: 0;
  background: ${p => p.theme.background};
  padding: ${space(1)};
  cursor: pointer;
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border-radius: ${p => p.theme.borderRadius};

  code {
    background-color: transparent;
  }

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const CardTitle = styled('p')`
  margin: 0;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.subText};
  word-break: break-word;
  white-space: pre-wrap;
  overflow-wrap: break-word;

  code {
    font-size: ${p => p.theme.fontSize.sm};
    background: transparent;
    padding: 2px 4px;
    border-radius: 2px;
    color: ${p => p.theme.subText};
  }
`;

const NoInsightsYet = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  color: ${p => p.theme.subText};
  text-align: center;
`;

export default AutofixInsightCards;
