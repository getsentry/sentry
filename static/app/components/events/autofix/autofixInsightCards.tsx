import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {TextArea} from 'sentry/components/core/textarea';
import {AutofixDiff} from 'sentry/components/events/autofix/autofixDiff';
import {AutofixHighlightWrapper} from 'sentry/components/events/autofix/autofixHighlightWrapper';
import AutofixInsightSources from 'sentry/components/events/autofix/autofixInsightSources';
import {replaceHeadersWithBold} from 'sentry/components/events/autofix/autofixRootCause';
import type {AutofixInsight} from 'sentry/components/events/autofix/types';
import {makeAutofixQueryKey} from 'sentry/components/events/autofix/useAutofix';
import {useTypingAnimation} from 'sentry/components/events/autofix/useTypingAnimation';
import {IconChevron, IconClose} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface AutofixInsightCardProps {
  groupId: string;
  index: number;
  insight: AutofixInsight;
  isExpanded: boolean;
  isNewInsight: boolean | undefined;
  onToggleExpand: (index: number | null) => void;
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
  isExpanded,
  onToggleExpand,
}: AutofixInsightCardProps) {
  const isUserMessage = insight.justification === 'USER';
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const {mutate: updateInsight} = useUpdateInsightCard({groupId, runId});
  const displayedInsightTitle = useTypingAnimation({
    text: insight.insight,
    enabled: !!isNewInsight,
    speed: 70,
  });

  const toggleExpand = () => {
    onToggleExpand(index);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditText('');
    onToggleExpand(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditText('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsEditing(false);
    updateInsight({
      message: editText,
      step_index: stepIndex,
      retain_insight_card_index: index,
    });
  };

  const insightCardAboveIndex = index - 1 >= 0 ? index - 1 : null;

  const newlineIndex = displayedInsightTitle.indexOf('\n');

  const truncatedTitleHtml = useMemo(() => {
    let truncatedTitle = displayedInsightTitle;
    if (newlineIndex !== -1 && newlineIndex < displayedInsightTitle.length - 1) {
      truncatedTitle = ellipsize(truncatedTitle, newlineIndex);
    }
    return {
      __html: singleLineRenderer(truncatedTitle),
    };
  }, [displayedInsightTitle, newlineIndex]);

  const hasFullJustification = !isUserMessage && insight.justification;

  const fullJustificationText = useMemo(() => {
    let fullJustification = isUserMessage ? '' : insight.justification;
    if (newlineIndex !== -1) {
      const excludedText = displayedInsightTitle.substring(newlineIndex + 1);
      const excludedTextWithEllipsis = excludedText ? '...' + excludedText : '';
      fullJustification = excludedTextWithEllipsis + '\n\n' + fullJustification;
    }
    return replaceHeadersWithBold(fullJustification || t('No details here.'));
  }, [displayedInsightTitle, isUserMessage, insight.justification, newlineIndex]);

  // Determine if the card is expandable (not just 'No details here.')
  const isExpandable = useMemo(() => {
    // Remove markdown formatting and whitespace for the check
    const plainText = (hasFullJustification ? insight.justification : '').trim();
    // If there is a diff or markdown_snippets, allow expansion
    if (insight.change_diff || insight.markdown_snippets) return true;
    // If the justification is empty or just 'No details here.', not expandable
    return !!plainText && plainText.toLowerCase() !== t('No details here.').toLowerCase();
  }, [
    hasFullJustification,
    insight.justification,
    insight.change_diff,
    insight.markdown_snippets,
  ]);

  return (
    <ContentWrapper>
      <AnimatePresence initial={isNewInsight}>
        <AnimationWrapper key="content">
          <InsightContainer
            data-new-insight={isNewInsight ? 'true' : 'false'}
            expanded={isExpanded}
          >
            {isEditing ? (
              <EditContainer>
                <form onSubmit={handleSubmit}>
                  <EditFormRow>
                    <EditInput
                      autosize
                      value={editText}
                      maxLength={4096}
                      onChange={e => setEditText(e.target.value)}
                      placeholder={t('Share your own insight here...')}
                      autoFocus
                      maxRows={5}
                      size="sm"
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSubmit(e);
                        } else if (e.key === 'Escape') {
                          handleCancel();
                        }
                      }}
                    />
                    <ButtonBar merged>
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleCancel}
                        title={t('Cancel')}
                        aria-label={t('Cancel')}
                      >
                        <IconClose size="sm" />
                      </Button>
                      <Button
                        type="submit"
                        priority="primary"
                        size="sm"
                        title={t('Redo work from here')}
                        aria-label={t('Redo work from here')}
                        analyticsEventName="Autofix: Insight Card Rethink Open"
                        analyticsEventKey="autofix.insight.rethink_open"
                        analyticsParams={{
                          insight_card_index: index,
                          step_index: stepIndex,
                          group_id: groupId,
                          run_id: runId,
                        }}
                      >
                        {'\u23CE'}
                      </Button>
                    </ButtonBar>
                  </EditFormRow>
                </form>
              </EditContainer>
            ) : (
              <InsightCardRow
                onClick={isExpandable ? toggleExpand : undefined}
                expanded={isExpanded}
                style={isExpandable ? {} : {cursor: 'default', background: 'none'}}
              >
                <AutofixHighlightWrapper
                  groupId={groupId}
                  runId={runId}
                  stepIndex={stepIndex}
                  retainInsightCardIndex={insightCardAboveIndex}
                >
                  <MiniHeader
                    dangerouslySetInnerHTML={truncatedTitleHtml}
                    expanded={isExpanded}
                  />
                </AutofixHighlightWrapper>

                <RightSection>
                  {isExpandable && (
                    <Button
                      size="zero"
                      borderless
                      title={isExpanded ? t('Hide evidence') : t('Show evidence')}
                      icon={
                        <StyledIconChevron
                          direction={isExpanded ? 'up' : 'down'}
                          size="xs"
                        />
                      }
                      aria-label={isExpanded ? t('Hide evidence') : t('Show evidence')}
                    />
                  )}
                  <EditButton
                    size="zero"
                    borderless
                    onClick={handleEdit}
                    icon={<FlippedReturnIcon />}
                    aria-label={t('Edit insight')}
                    title={t('Rethink the answer from here')}
                    analyticsEventName="Autofix: Insight Card Rethink"
                    analyticsEventKey="autofix.insight.rethink"
                    analyticsParams={{
                      insight_card_index: index,
                      step_index: stepIndex,
                      group_id: groupId,
                      run_id: runId,
                    }}
                  />
                </RightSection>
              </InsightCardRow>
            )}

            <AnimatePresence>
              {isExpanded && isExpandable && (
                <motion.div
                  initial={{height: 0, opacity: 0}}
                  animate={{height: 'auto', opacity: 1}}
                  exit={{height: 0, opacity: 0}}
                  transition={{
                    type: 'spring',
                    duration: 0.4,
                    bounce: 0.1,
                  }}
                >
                  <ContextBody>
                    <AutofixHighlightWrapper
                      groupId={groupId}
                      runId={runId}
                      stepIndex={stepIndex}
                      retainInsightCardIndex={insightCardAboveIndex}
                    >
                      {hasFullJustification || !insight.change_diff ? (
                        <Fragment>
                          <ContextMarkedText as="p" text={fullJustificationText} />
                          {insight.markdown_snippets && (
                            <ContextMarkedText as="p" text={insight.markdown_snippets} />
                          )}
                        </Fragment>
                      ) : (
                        <DiffContainer>
                          <AutofixDiff
                            diff={insight.change_diff}
                            groupId={groupId}
                            runId={runId}
                            editable={false}
                            integratedStyle
                          />
                        </DiffContainer>
                      )}
                    </AutofixHighlightWrapper>
                    <AutofixInsightSources
                      sources={insight.sources}
                      title={insight.insight}
                    />
                  </ContextBody>
                </motion.div>
              )}
            </AnimatePresence>
          </InsightContainer>
        </AnimationWrapper>
      </AnimatePresence>
    </ContentWrapper>
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

interface CollapsibleChainLinkProps {
  groupId: string;
  runId: string;
  stepIndex: number;
  insightCount?: number;
  isCollapsed?: boolean;
  isEmpty?: boolean;
  onToggleCollapse?: () => void;
  showAddControl?: boolean;
  showCollapseControl?: boolean;
}

function CollapsibleChainLink({
  insightCount,
  isCollapsed,
  isEmpty,
  onToggleCollapse,
  showAddControl,
  showCollapseControl,
  stepIndex,
  groupId,
  runId,
}: CollapsibleChainLinkProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newInsightText, setNewInsightText] = useState('');
  const {mutate: updateInsight} = useUpdateInsightCard({groupId, runId});

  const organization = useOrganization();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(false);
    updateInsight({
      message: newInsightText,
      step_index: stepIndex,
      retain_insight_card_index:
        insightCount !== undefined && insightCount > 0 ? insightCount : null,
    });
    setNewInsightText('');

    trackAnalytics('autofix.step.rethink', {
      step_index: stepIndex,
      group_id: groupId,
      run_id: runId,
      organization,
    });
  };

  const handleCancel = () => {
    setIsAdding(false);
    setNewInsightText('');
  };

  return (
    <VerticalLineContainer isEmpty={isEmpty}>
      <RethinkButtonContainer className="rethink-button-container">
        {showCollapseControl && onToggleCollapse && (
          <CollapseButtonWrapper
            onClick={onToggleCollapse}
            title={isCollapsed ? t('Show reasoning') : t('Hide reasoning')}
            aria-label={t('Toggle reasoning visibility icon')}
          >
            {isCollapsed && insightCount && insightCount > 0 ? (
              <CollapsedCount>
                {tn('%s insight hidden', '%s insights hidden', insightCount)}
              </CollapsedCount>
            ) : (
              <CollapsedCount>{}</CollapsedCount>
            )}
            <CollapseButton
              size="zero"
              borderless
              icon={
                <CollapseIconChevron direction={isCollapsed ? 'down' : 'up'} size="sm" />
              }
              aria-label={t('Toggle reasoning visibility')}
            />
          </CollapseButtonWrapper>
        )}
        {showAddControl &&
          !isCollapsed &&
          !isEmpty &&
          (isAdding ? (
            <AddEditContainer>
              <form onSubmit={handleSubmit}>
                <EditFormRow>
                  <EditInput
                    type="text"
                    value={newInsightText}
                    onChange={e => setNewInsightText(e.target.value)}
                    maxLength={4096}
                    placeholder={t('Share your own insight here...')}
                    autoFocus
                    autosize
                    size="sm"
                    maxRows={5}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmit(e);
                      } else if (e.key === 'Escape') {
                        handleCancel();
                      }
                    }}
                  />
                  <ButtonBar merged>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleCancel}
                      title={t('Cancel')}
                    >
                      <IconClose size="sm" />
                    </Button>
                    <Button
                      type="submit"
                      priority="primary"
                      size="sm"
                      title={t('Redo work from here')}
                      aria-label={t('Redo work from here')}
                    >
                      {'\u23CE'}
                    </Button>
                  </ButtonBar>
                </EditFormRow>
              </form>
            </AddEditContainer>
          ) : (
            <AddButton
              size="zero"
              borderless
              onClick={() => setIsAdding(true)}
              title={t('Give feedback and rethink the answer')}
              aria-label={t('Give feedback and rethink the answer')}
              analyticsEventName="Autofix: Step Rethink Open"
              analyticsEventKey="autofix.step.rethink_open"
              analyticsParams={{
                step_index: stepIndex,
                group_id: groupId,
                run_id: runId,
              }}
            >
              <RethinkLabel>{t('Rethink this answer')}</RethinkLabel>
              <FlippedReturnIcon />
            </AddButton>
          ))}
      </RethinkButtonContainer>
    </VerticalLineContainer>
  );
}

function AutofixInsightCards({
  insights,
  hasStepBelow,
  hasStepAbove,
  stepIndex,
  groupId,
  runId,
  shouldCollapseByDefault,
}: AutofixInsightCardsProps) {
  const [isCollapsed, setIsCollapsed] = useState(shouldCollapseByDefault ?? false);
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
      setNewInsightIndices([insights.length - 1]);
    } else {
      setNewInsightIndices([]);
    }
    previousInsightsRef.current = [...insights];
  }, [insights]);

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
    // Close any expanded card when collapsing the section
    if (!isCollapsed) {
      setExpandedCardIndex(null);
    }
  };

  const handleToggleExpand = (index: number | null) => {
    setExpandedCardIndex(prevIndex => (prevIndex === index ? null : index));
  };

  const validInsightCount = insights.filter(insight => insight).length;

  return (
    <InsightsGridContainer>
      <LineColumn>
        <VerticalLine />
      </LineColumn>
      <CardsColumn>
        {insights.length > 0 ? (
          <Fragment>
            {hasStepAbove && (
              <CollapsibleChainLink
                isCollapsed={isCollapsed}
                onToggleCollapse={handleToggleCollapse}
                insightCount={validInsightCount}
                showCollapseControl
                stepIndex={stepIndex}
                groupId={groupId}
                runId={runId}
              />
            )}
            <AnimatePresence initial={hasMounted.current}>
              {!isCollapsed && (
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
              )}
            </AnimatePresence>
            {!isCollapsed && hasStepBelow && (
              <CollapsibleChainLink
                isEmpty={insights.length === 0}
                stepIndex={stepIndex}
                groupId={groupId}
                runId={runId}
                insightCount={validInsightCount}
                showAddControl
              />
            )}
          </Fragment>
        ) : stepIndex === 0 && !hasStepBelow ? (
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
      </CardsColumn>
    </InsightsGridContainer>
  );
}

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
      addSuccessMessage(t('Rethinking this...'));
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when sending Seer your message.'));
    },
  });
}

const InsightCardRow = styled('div')<{expanded?: boolean; isUserMessage?: boolean}>`
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  cursor: pointer;

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const NoInsightsYet = styled('div')`
  display: flex;
  justify-content: center;
  flex-direction: column;
  color: ${p => p.theme.subText};
`;

const InsightsGridContainer = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  position: relative;
  z-index: 0;
`;

const LineColumn = styled('div')`
  position: relative;
  width: 32px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const CardsColumn = styled('div')`
  display: flex;
  flex-direction: column;
`;

const CardsStack = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 0;
`;

const ContextMarkedText = styled(MarkedText)`
  font-size: ${p => p.theme.fontSize.sm};
  code {
    font-size: ${p => p.theme.fontSize.sm};
  }
`;

const InsightContainer = styled(motion.div)<{expanded?: boolean}>`
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  margin-bottom: 0;
  background: ${p => p.theme.background};
  border: 1px dashed ${p => p.theme.border};
  border-color: ${p => (p.expanded ? p.theme.border : 'transparent')};

  box-shadow: ${p => (p.expanded ? p.theme.dropShadowMedium : 'none')};

  &[data-new-insight='true'] {
    animation: fadeFromActive 0.8s ease-in-out;
    @keyframes fadeFromActive {
      from {
        background-color: ${p => p.theme.purple400};
        border-color: ${p => p.theme.purple400};
        transform: scaleY(0);
        height: 0;
        opacity: 0;
      }
      to {
        background-color: ${p => p.theme.background};
        border-color: ${p => p.theme.innerBorder};
        transform: scaleY(1);
        height: auto;
        opacity: 1;
      }
    }
  }
`;

const VerticalLineContainer = styled('div')<{
  isEmpty?: boolean;
}>`
  position: relative;
  z-index: 1;
  width: 100%;
  display: flex;
  padding: 0;
  min-height: ${p => (p.isEmpty ? space(4) : 'auto')};
`;

const VerticalLine = styled('div')`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: ${p => p.theme.subText};
  transition: background-color 0.2s ease;
  z-index: 0;
`;

const CollapseButtonWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  cursor: pointer;
  border-radius: ${p => p.theme.borderRadius};

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const RethinkButtonContainer = styled('div')`
  position: relative;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  width: 100%;
  background: ${p => p.theme.background};
  border-radius: 0;
  padding: 0;
  z-index: 1;

  &:has(> ${CollapseButtonWrapper}) {
    padding: 0;
  }
`;

const ContentWrapper = styled('div')``;

const MiniHeader = styled('p')<{expanded?: boolean}>`
  padding-top: ${space(0.25)};
  padding-bottom: ${space(0.25)};
  padding-left: ${space(1)};
  padding-right: ${space(2)};
  margin: 0;
  flex: 1;
  word-break: break-word;
  color: ${p => (p.expanded ? p.theme.textColor : p.theme.subText)};
`;

const ContextBody = styled('div')`
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
  background: ${p => p.theme.pink400}05;
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  overflow: hidden;
  position: relative;
  border-top: 1px dashed ${p => p.theme.innerBorder};

  code {
    white-space: pre-wrap;
    word-break: break-word;
    background-color: transparent;
  }
`;

const AnimationWrapper = styled(motion.div)`
  transform-origin: top center;

  &[data-new-insight='true'] {
    animation: textFadeFromActive 1.2s ease-out;
    @keyframes textFadeFromActive {
      from {
        color: ${p => p.theme.white};
      }
      to {
        color: inherit;
      }
    }
  }
`;

const StyledIconChevron = styled(IconChevron)`
  color: ${p => p.theme.subText};
  &:hover {
    color: ${p => p.theme.pink400};
  }
`;

const RightSection = styled('div')`
  display: flex;
  align-items: center;
  padding-right: ${space(0.5)};
`;

const EditContainer = styled('div')`
  padding: ${space(1)};
  width: 100%;
`;

const EditFormRow = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  width: 100%;
`;

const EditInput = styled(TextArea)`
  flex: 1;
  resize: none;
`;

const EditButton = styled(Button)`
  color: ${p => p.theme.subText};
  &:hover {
    color: ${p => p.theme.pink400};
  }
`;

const CollapseButton = styled(Button)`
  pointer-events: none;
  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const CollapseIconChevron = styled(IconChevron)`
  color: ${p => p.theme.subText};
`;

const CollapsedCount = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
`;

const AddEditContainer = styled('div')`
  padding: ${space(1)};
  width: 100%;
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
`;

const DiffContainer = styled('div')`
  margin-left: -${space(2)};
  margin-right: -${space(2)};
  margin-top: -${space(2)};
`;

const AddButton = styled(Button)`
  color: ${p => p.theme.subText};
  &:hover {
    color: ${p => p.theme.pink400};
  }
`;

function FlippedReturnIcon(props: React.HTMLAttributes<HTMLSpanElement>) {
  return <CheckpointIcon {...props}>{'\u21A9'}</CheckpointIcon>;
}

export default AutofixInsightCards;

const CheckpointIcon = styled('span')`
  transform: scaleY(-1);
  margin-bottom: ${space(0.5)};
`;

const RethinkLabel = styled('span')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  margin-right: ${space(0.5)};
`;
