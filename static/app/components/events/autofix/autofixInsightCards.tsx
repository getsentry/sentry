import {Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Input} from 'sentry/components/core/input';
import {AutofixDiff} from 'sentry/components/events/autofix/autofixDiff';
import {AutofixHighlightWrapper} from 'sentry/components/events/autofix/autofixHighlightWrapper';
import {replaceHeadersWithBold} from 'sentry/components/events/autofix/autofixRootCause';
import type {AutofixInsight} from 'sentry/components/events/autofix/types';
import {makeAutofixQueryKey} from 'sentry/components/events/autofix/useAutofix';
import {IconChevron, IconClose, IconRefresh} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import marked, {singleLineRenderer} from 'sentry/utils/marked';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

export function ExpandableInsightContext({
  children,
  title,
  icon,
  rounded,
  expandByDefault = false,
}: {
  children: React.ReactNode;
  title: string;
  expandByDefault?: boolean;
  icon?: React.ReactNode;
  rounded?: boolean;
}) {
  const [expanded, setExpanded] = useState(expandByDefault);

  const toggleExpand = () => {
    setExpanded(oldState => !oldState);
  };

  return (
    <ExpandableContext isRounded={rounded}>
      <ContextHeader
        onClick={toggleExpand}
        name={title}
        isRounded={rounded}
        isExpanded={expanded}
        size="sm"
      >
        <ContextHeaderWrapper>
          <ContextHeaderLeftAlign>
            {icon}
            <ContextHeaderText>{title}</ContextHeaderText>
          </ContextHeaderLeftAlign>
          <IconChevron size="xs" direction={expanded ? 'down' : 'right'} />
        </ContextHeaderWrapper>
      </ContextHeader>
      {expanded && <ContextBody>{children}</ContextBody>}
    </ExpandableContext>
  );
}

interface AutofixInsightCardProps {
  groupId: string;
  hasCardAbove: boolean;
  hasCardBelow: boolean;
  index: number;
  insight: AutofixInsight;
  insightCount: number;
  runId: string;
  stepIndex: number;
  isNewInsight?: boolean;
}

function AutofixInsightCard({
  insight,
  hasCardBelow,
  hasCardAbove,
  index,
  stepIndex,
  groupId,
  runId,
  insightCount,
  isNewInsight,
}: AutofixInsightCardProps) {
  const isLastInsightInStep = index === insightCount - 1;
  const isUserMessage = insight.justification === 'USER';
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const {mutate: updateInsight} = useUpdateInsightCard({groupId, runId});

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

  return (
    <ContentWrapper>
      <AnimatePresence initial={isNewInsight}>
        <AnimationWrapper key="content">
          {hasCardAbove && (
            <ChainLink
              stepIndex={stepIndex}
              groupId={groupId}
              runId={runId}
              insightCount={insightCount}
            />
          )}
          <InsightContainer data-new-insight={isNewInsight ? 'true' : 'false'}>
            {isEditing ? (
              <EditContainer>
                <form onSubmit={handleSubmit}>
                  <EditFormRow>
                    <EditInput
                      type="text"
                      value={editText}
                      maxLength={4096}
                      onChange={e => setEditText(e.target.value)}
                      placeholder={t('Share your own insight here...')}
                      autoFocus
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
              <InsightCardRow
                onClick={isUserMessage ? undefined : toggleExpand}
                isUserMessage={isUserMessage}
              >
                <AutofixHighlightWrapper
                  groupId={groupId}
                  runId={runId}
                  stepIndex={stepIndex}
                  retainInsightCardIndex={insightCardAboveIndex}
                >
                  <MiniHeader>
                    <div
                      dangerouslySetInnerHTML={{
                        __html: singleLineRenderer(insight.insight),
                      }}
                    />
                  </MiniHeader>
                </AutofixHighlightWrapper>

                <RightSection>
                  {!isUserMessage && (
                    <Button
                      size="zero"
                      borderless
                      title={expanded ? t('Hide evidence') : t('Show evidence')}
                      icon={
                        <StyledIconChevron
                          direction={expanded ? 'down' : 'right'}
                          size="sm"
                        />
                      }
                      aria-label={expanded ? t('Hide evidence') : t('Show evidence')}
                    />
                  )}
                  <EditButton
                    size="zero"
                    borderless
                    onClick={handleEdit}
                    icon={<IconRefresh size="sm" />}
                    aria-label={t('Edit insight')}
                    title={t('Replace insight and rethink')}
                  />
                </RightSection>
              </InsightCardRow>
            )}

            <AnimatePresence>
              {expanded && !isUserMessage && (
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
                      {insight.justification || !insight.change_diff ? (
                        <MiniHeader
                          dangerouslySetInnerHTML={{
                            __html: marked(
                              replaceHeadersWithBold(
                                insight.justification || t('No details here.')
                              )
                            ),
                          }}
                        />
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

          {hasCardBelow && (
            <ChainLink
              isLastCard={isLastInsightInStep}
              stepIndex={stepIndex}
              groupId={groupId}
              runId={runId}
              insightCount={insightCount}
            />
          )}
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

function CollapsibleChainLink({
  isEmpty,
  isCollapsed,
  onToggleCollapse,
  insightCount,
}: {
  insightCount?: number;
  isCollapsed?: boolean;
  isEmpty?: boolean;
  onToggleCollapse?: () => void;
}) {
  return (
    <VerticalLineContainer isEmpty={isEmpty}>
      <VerticalLine />
      <RethinkButtonContainer className="rethink-button-container">
        {onToggleCollapse && (
          <CollapseButtonWrapper>
            {isCollapsed && insightCount && insightCount > 0 && (
              <CollapsedCount>
                {tn('%s insight hidden', '%s insights hidden', insightCount)}
              </CollapsedCount>
            )}
            <CollapseButton
              size="zero"
              borderless
              onClick={onToggleCollapse}
              icon={
                <CollapseIconChevron
                  direction={isCollapsed ? 'right' : 'down'}
                  size="sm"
                />
              }
              title={isCollapsed ? t('Show reasoning') : t('Hide reasoning')}
              aria-label={isCollapsed ? t('Show reasoning') : t('Hide reasoning')}
            />
          </CollapseButtonWrapper>
        )}
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
  const [isCollapsed, setIsCollapsed] = useState(!!shouldCollapseByDefault);
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

  useEffect(() => {
    setIsCollapsed(!!shouldCollapseByDefault);
  }, [shouldCollapseByDefault]);

  const handleToggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  const validInsightCount = insights.filter(insight => insight).length;

  return (
    <InsightsContainer>
      {insights.length > 0 ? (
        <Fragment>
          {hasStepAbove && (
            <CollapsibleChainLink
              isCollapsed={isCollapsed}
              onToggleCollapse={handleToggleCollapse}
              insightCount={validInsightCount}
            />
          )}
          <AnimatePresence>
            {!isCollapsed && (
              <motion.div
                initial={{height: 0, opacity: 0}}
                animate={{height: 'auto', opacity: 1}}
                exit={{height: 0, opacity: 0}}
                transition={{duration: 0.3}}
              >
                {insights.map((insight, index) =>
                  insight ? (
                    <AutofixInsightCard
                      key={index}
                      insight={insight}
                      hasCardBelow={index < insights.length - 1 || hasStepBelow}
                      hasCardAbove={false}
                      index={index}
                      stepIndex={stepIndex}
                      groupId={groupId}
                      runId={runId}
                      insightCount={validInsightCount}
                      isNewInsight={newInsightIndices.includes(index)}
                    />
                  ) : null
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Fragment>
      ) : stepIndex === 0 && !hasStepBelow ? (
        <NoInsightsYet />
      ) : hasStepBelow ? (
        <EmptyResultsContainer>
          <ChainLink
            isLastCard
            isEmpty
            stepIndex={stepIndex}
            groupId={groupId}
            runId={runId}
            insightCount={validInsightCount}
          />
        </EmptyResultsContainer>
      ) : null}
    </InsightsContainer>
  );
}

export function useUpdateInsightCard({groupId, runId}: {groupId: string; runId: string}) {
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
            message: params.message,
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

interface ChainLinkProps {
  groupId: string;
  insightCount: number;
  runId: string;
  stepIndex: number;
  isEmpty?: boolean;
  isLastCard?: boolean;
}

function ChainLink({
  isLastCard,
  isEmpty,
  stepIndex,
  groupId,
  runId,
  insightCount,
}: ChainLinkProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [newInsightText, setNewInsightText] = useState('');
  const {mutate: updateInsight} = useUpdateInsightCard({groupId, runId});

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsAdding(false);
    updateInsight({
      message: newInsightText,
      step_index: stepIndex,
      retain_insight_card_index: insightCount,
    });
    setNewInsightText('');
  };

  const handleCancel = () => {
    setIsAdding(false);
    setNewInsightText('');
  };

  return (
    <VerticalLineContainer isEmpty={isEmpty}>
      <VerticalLine />
      <RethinkButtonContainer className="rethink-button-container">
        {isLastCard &&
          (isAdding ? (
            <EditContainer>
              <form onSubmit={handleSubmit}>
                <EditFormRow>
                  <EditInput
                    type="text"
                    value={newInsightText}
                    onChange={e => setNewInsightText(e.target.value)}
                    maxLength={4096}
                    placeholder={t('Share your own insight here...')}
                    autoFocus
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
            </EditContainer>
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

const InsightCardRow = styled('div')<{isUserMessage?: boolean}>`
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  cursor: ${p => (p.isUserMessage ? 'default' : 'pointer')};
  &:hover {
    background-color: ${p => (p.isUserMessage ? 'inherit' : p.theme.backgroundSecondary)};
  }
`;

const NoInsightsYet = styled('div')`
  display: flex;
  justify-content: center;
  flex-direction: column;
  color: ${p => p.theme.subText};
`;

const EmptyResultsContainer = styled('div')`
  position: relative;
  min-height: ${space(2)};
`;

const InsightsContainer = styled('div')`
  z-index: 0;
`;

const InsightContainer = styled(motion.div)`
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;

  &[data-new-insight='true'] {
    animation: fadeFromActive 0.8s ease-in-out;
    @keyframes fadeFromActive {
      from {
        background-color: ${p => p.theme.active};
        border-color: ${p => p.theme.active};
        scale: 0.8;
        height: 0;
        opacity: 0;
      }
      to {
        background-color: ${p => p.theme.background};
        border-color: ${p => p.theme.innerBorder};
        scale: 1;
        height: auto;
        opacity: 1;
      }
    }
  }
`;

const VerticalLineContainer = styled('div')<{isEmpty?: boolean}>`
  display: grid;
  grid-template-columns: 32px auto 1fr;
  position: relative;
  z-index: 0;
  min-height: ${p => (p.isEmpty ? space(4) : space(2))};
  width: 100%;

  .rethink-button-container {
    grid-column: 1 / -1;
    justify-self: stretch;
    align-self: center;
    position: relative;
    padding-right: ${space(1)};
  }
`;

const VerticalLine = styled('div')`
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  background-color: ${p => p.theme.subText};
  grid-column: 2 / 3;
  transition: background-color 0.2s ease;
`;

const RethinkButtonContainer = styled('div')`
  position: relative;
  display: flex;
  justify-content: flex-end;
  width: calc(100% + ${space(1)});
`;

const ContentWrapper = styled('div')``;

const MiniHeader = styled('p')`
  padding-top: ${space(0.75)};
  padding-bottom: ${space(0.75)};
  padding-left: ${space(1)};
  padding-right: ${space(2)};
  margin: 0;
  flex: 1;
  word-break: break-word;
`;

const ExpandableContext = styled('div')<{isRounded?: boolean}>`
  width: 100%;
  border-radius: ${p => (p.isRounded ? p.theme.borderRadius : 0)};
`;

const ContextHeader = styled(Button)<{isExpanded?: boolean; isRounded?: boolean}>`
  width: 100%;
  box-shadow: none;
  margin: 0;
  border: none;
  font-weight: normal;
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => {
    if (!p.isRounded) {
      return 0;
    }
    if (p.isExpanded) {
      return `${p.theme.borderRadius} ${p.theme.borderRadius} 0 0`;
    }
    return p.theme.borderRadius;
  }};
`;

const ContextHeaderLeftAlign = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const ContextHeaderWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const ContextHeaderText = styled('p')`
  height: 0;
`;

const ContextBody = styled('div')`
  padding: ${space(2)} ${space(2)} 0;
  background: ${p => p.theme.background}
    linear-gradient(135deg, ${p => p.theme.pink400}08, ${p => p.theme.pink400}20);
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  overflow: hidden;
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
  color: ${p => p.theme.textColor};
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

const EditInput = styled(Input)`
  flex: 1;
`;

const EditButton = styled(Button)`
  color: ${p => p.theme.textColor};
  &:hover {
    color: ${p => p.theme.pink400};
  }
`;

const CollapseButton = styled(Button)`
  &:hover {
    color: ${p => p.theme.textColor};
  }
`;

const CollapseIconChevron = styled(IconChevron)`
  color: ${p => p.theme.subText};
`;

const CollapseButtonWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const CollapsedCount = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const AddButton = styled(Button)`
  color: ${p => p.theme.textColor};
  &:hover {
    color: ${p => p.theme.pink400};
  }
  margin-right: ${space(1)};
`;

const DiffContainer = styled('div')`
  margin-bottom: ${space(2)};
`;

export default AutofixInsightCards;
