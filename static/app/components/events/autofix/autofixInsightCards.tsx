import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {TextArea} from 'sentry/components/core/textarea';
import {AutofixDiff} from 'sentry/components/events/autofix/autofixDiff';
import {AutofixHighlightWrapper} from 'sentry/components/events/autofix/autofixHighlightWrapper';
import {replaceHeadersWithBold} from 'sentry/components/events/autofix/autofixRootCause';
import type {AutofixInsight} from 'sentry/components/events/autofix/types';
import {makeAutofixQueryKey} from 'sentry/components/events/autofix/useAutofix';
import {useTypingAnimation} from 'sentry/components/events/autofix/useTypingAnimation';
import {IconChevron, IconClose, IconRefresh} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {singleLineRenderer} from 'sentry/utils/marked/marked';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

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
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const {mutate: updateInsight} = useUpdateInsightCard({groupId, runId});
  const displayedInsightTitle = useTypingAnimation({
    text: insight.insight,
    enabled: !!isNewInsight,
    speed: 70,
  });

  const toggleExpand = () => {
    setExpanded(oldState => !oldState);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditing(true);
    setEditText('');
    setExpanded(false);
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
      truncatedTitle = displayedInsightTitle.substring(0, newlineIndex) + '...';
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

  return (
    <ContentWrapper>
      <AnimatePresence initial={isNewInsight}>
        <AnimationWrapper key="content">
          <InsightContainer
            data-new-insight={isNewInsight ? 'true' : 'false'}
            expanded={expanded}
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
                        title={t('Rethink from here using your insight')}
                        aria-label={t('Rethink from here using your insight')}
                      >
                        <IconRefresh size="sm" />
                      </Button>
                    </ButtonBar>
                  </EditFormRow>
                </form>
              </EditContainer>
            ) : (
              <InsightCardRow onClick={toggleExpand}>
                <AutofixHighlightWrapper
                  groupId={groupId}
                  runId={runId}
                  stepIndex={stepIndex}
                  retainInsightCardIndex={insightCardAboveIndex}
                >
                  <MiniHeader dangerouslySetInnerHTML={truncatedTitleHtml} />
                </AutofixHighlightWrapper>

                <RightSection>
                  <Button
                    size="zero"
                    borderless
                    title={expanded ? t('Hide evidence') : t('Show evidence')}
                    icon={
                      <StyledIconChevron
                        direction={expanded ? 'down' : 'right'}
                        size="xs"
                      />
                    }
                    aria-label={expanded ? t('Hide evidence') : t('Show evidence')}
                  />
                  <EditButton
                    size="zero"
                    borderless
                    onClick={handleEdit}
                    icon={<IconRefresh size="xs" />}
                    aria-label={t('Edit insight')}
                    title={t('Replace insight and rethink')}
                  />
                </RightSection>
              </InsightCardRow>
            )}

            <AnimatePresence>
              {expanded && (
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
                  <AutofixHighlightWrapper
                    groupId={groupId}
                    runId={runId}
                    stepIndex={stepIndex}
                    retainInsightCardIndex={insightCardAboveIndex}
                  >
                    <ContextBody>
                      {hasFullJustification || !insight.change_diff ? (
                        <MarkedText as="p" text={fullJustificationText} />
                      ) : (
                        <DiffContainer>
                          <AutofixDiff
                            diff={insight.change_diff}
                            groupId={groupId}
                            runId={runId}
                            editable={false}
                            isExpandable={false}
                          />
                        </DiffContainer>
                      )}
                    </ContextBody>
                  </AutofixHighlightWrapper>
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
}

interface CollapsibleChainLinkProps {
  groupId: string;
  runId: string;
  stepIndex: number;
  alignment?: 'start' | 'center';
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
  alignment = 'center',
}: CollapsibleChainLinkProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newInsightText, setNewInsightText] = useState('');
  const {mutate: updateInsight} = useUpdateInsightCard({groupId, runId});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(false);
    updateInsight({
      message: newInsightText,
      step_index: stepIndex,
      retain_insight_card_index:
        insightCount !== undefined && insightCount > 0 ? insightCount - 1 : null,
    });
    setNewInsightText('');
  };

  const handleCancel = () => {
    setIsAdding(false);
    setNewInsightText('');
  };

  return (
    <VerticalLineContainer isEmpty={isEmpty} alignment={alignment}>
      <RethinkButtonContainer
        className="rethink-button-container"
        parentAlignment={alignment}
      >
        {/* Render Collapse Controls */}
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
                <CollapseIconChevron
                  direction={isCollapsed ? 'right' : 'down'}
                  size="sm"
                />
              }
              aria-label={t('Toggle reasoning visibility')}
            />
          </CollapseButtonWrapper>
        )}
        {/* Render Add Controls */}
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
                      title={t('Add insight and rethink')}
                      aria-label={t('Add insight and rethink')}
                    >
                      <IconRefresh size="sm" />
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
              icon={<IconRefresh size="sm" />}
              title={t('Add insight and rethink')}
              aria-label={t('Add insight and rethink')}
            />
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
}: AutofixInsightCardsProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const previousInsightsRef = useRef<AutofixInsight[]>([]);
  const [newInsightIndices, setNewInsightIndices] = useState<number[]>([]);

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
            {/* Render collapse link above cards if hasStepAbove */}
            {hasStepAbove && (
              <CollapsibleChainLink
                isCollapsed={isCollapsed}
                onToggleCollapse={handleToggleCollapse}
                insightCount={validInsightCount}
                showCollapseControl
                stepIndex={stepIndex}
                groupId={groupId}
                runId={runId}
                alignment="start"
              />
            )}
            <AnimatePresence>
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
                        />
                      ) : null
                    )}
                  </CardsStack>
                </motion.div>
              )}
            </AnimatePresence>
            {/* Render AddLink below cards if not collapsed and hasStepBelow */}
            {!isCollapsed && hasStepBelow && (
              <CollapsibleChainLink
                isEmpty={insights.length === 0}
                stepIndex={stepIndex}
                groupId={groupId}
                runId={runId}
                insightCount={validInsightCount}
                showAddControl
                alignment="start"
              />
            )}
          </Fragment>
        ) : stepIndex === 0 && !hasStepBelow ? (
          <NoInsightsYet />
        ) : null}
      </CardsColumn>
    </InsightsGridContainer>
  );
}

function useUpdateInsightCard({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      message: string;
      retain_insight_card_index: number | null;
      step_index: number;
    }) => {
      return api.requestPromise(`/issues/${groupId}/autofix/update/`, {
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
      });
    },
    onSuccess: _ => {
      queryClient.invalidateQueries({queryKey: makeAutofixQueryKey(groupId)});
      addSuccessMessage(t('Rethinking this...'));
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when sending Autofix your message.'));
    },
  });
}

const InsightCardRow = styled('div')<{isUserMessage?: boolean}>`
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

const InsightContainer = styled(motion.div)<{expanded?: boolean}>`
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  margin-bottom: 0;
  background: ${p => p.theme.background};

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
  alignment?: 'start' | 'center';
  isEmpty?: boolean;
}>`
  position: relative;
  z-index: 1;
  width: 100%;
  display: flex;
  padding: 0;
  min-height: ${p => (p.isEmpty ? space(4) : 'auto')};

  .rethink-button-container {
    /* Styles are now primarily in RethinkButtonContainer itself */
  }
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

const RethinkButtonContainer = styled('div')<{parentAlignment?: 'start' | 'center'}>`
  position: relative;
  display: flex;
  justify-content: ${p => (p.parentAlignment === 'start' ? 'flex-end' : 'center')};
  align-items: center;
  width: ${p => (p.parentAlignment === 'start' ? '100%' : 'max-content')};
  background: ${p =>
    p.parentAlignment === 'center' ? p.theme.background : 'transparent'};
  border-radius: ${p => (p.parentAlignment === 'center' ? '50%' : '0')};
  padding: ${p => (p.parentAlignment === 'center' ? space(0.25) : '0')};
  z-index: 1;

  &:has(> ${CollapseButtonWrapper}) {
    padding: 0;
  }
`;

const ContentWrapper = styled('div')``;

const MiniHeader = styled('p')`
  padding-top: ${space(0.25)};
  padding-bottom: ${space(0.25)};
  padding-left: ${space(1)};
  padding-right: ${space(2)};
  margin: 0;
  flex: 1;
  word-break: break-word;
  color: ${p => p.theme.subText};
`;

const ContextBody = styled('div')`
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
  background: ${p => p.theme.pink100};
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  overflow: hidden;
  position: relative;

  code {
    white-space: pre-wrap;
    word-break: break-word;
  }

  &::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 2px;
    background-color: ${p => p.theme.subText};
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
  padding-right: ${space(1)};
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
  font-size: ${p => p.theme.fontSizeSmall};
`;

const AddEditContainer = styled('div')`
  padding: ${space(1)};
  width: 100%;
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
`;

const DiffContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

const AddButton = styled(Button)`
  color: ${p => p.theme.subText};
  &:hover {
    color: ${p => p.theme.pink400};
  }
`;

export default AutofixInsightCards;
