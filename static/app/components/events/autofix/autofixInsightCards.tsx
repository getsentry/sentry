import {Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {replaceHeadersWithBold} from 'sentry/components/events/autofix/autofixRootCause';
import type {AutofixInsight} from 'sentry/components/events/autofix/types';
import {makeAutofixQueryKey} from 'sentry/components/events/autofix/useAutofix';
import Input from 'sentry/components/input';
import {IconAdd, IconChevron, IconClose, IconEdit, IconRefresh} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import marked, {singleLineRenderer} from 'sentry/utils/marked';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';

import AutofixHighlightPopup from './autofixHighlightPopup';
import {useTextSelection} from './useTextSelection';

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

const animationProps: AnimationProps = {
  exit: {opacity: 0, height: 0, scale: 0.8, y: -20},
  initial: {opacity: 0, height: 0, scale: 0.8},
  animate: {opacity: 1, height: 'auto', scale: 1},
  transition: testableTransition({
    duration: 1.0,
    height: {
      type: 'spring',
      bounce: 0.2,
    },
    scale: {
      type: 'spring',
      bounce: 0.2,
    },
    y: {
      type: 'tween',
      ease: 'easeOut',
    },
  }),
};

interface AutofixInsightCardProps {
  groupId: string;
  hasCardAbove: boolean;
  hasCardBelow: boolean;
  index: number;
  insight: AutofixInsight;
  insightCount: number;
  runId: string;
  stepIndex: number;
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
}: AutofixInsightCardProps) {
  const isLastInsightInStep = index === insightCount - 1;
  const headerRef = useRef<HTMLDivElement>(null);
  const justificationRef = useRef<HTMLDivElement>(null);
  const headerSelection = useTextSelection(headerRef);
  const justificationSelection = useTextSelection(justificationRef);
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
    const insightCardAboveIndex = index - 1 >= 0 ? index - 1 : null;
    updateInsight({
      message: editText,
      step_index: stepIndex,
      retain_insight_card_index: insightCardAboveIndex,
    });
  };

  const insightCardAboveIndex = index - 1 >= 0 ? index - 1 : null;

  return (
    <ContentWrapper>
      <AnimatePresence>
        {headerSelection && (
          <AutofixHighlightPopup
            selectedText={headerSelection.selectedText}
            referenceElement={headerSelection.referenceElement}
            groupId={groupId}
            runId={runId}
            stepIndex={stepIndex}
            retainInsightCardIndex={insightCardAboveIndex}
          />
        )}
        {justificationSelection && (
          <AutofixHighlightPopup
            selectedText={justificationSelection.selectedText}
            referenceElement={justificationSelection.referenceElement}
            groupId={groupId}
            runId={runId}
            stepIndex={stepIndex}
            retainInsightCardIndex={insightCardAboveIndex}
          />
        )}
      </AnimatePresence>
      <AnimatePresence initial>
        <AnimationWrapper key="content" {...animationProps}>
          {hasCardAbove && (
            <ChainLink
              stepIndex={stepIndex}
              groupId={groupId}
              runId={runId}
              insightCount={insightCount}
            />
          )}
          <InsightContainer>
            {isEditing ? (
              <EditContainer>
                <form onSubmit={handleSubmit}>
                  <EditFormRow>
                    <EditInput
                      type="text"
                      value={editText}
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
                onClick={!isUserMessage ? toggleExpand : undefined}
                isUserMessage={isUserMessage}
              >
                <MiniHeader
                  ref={headerRef}
                  dangerouslySetInnerHTML={{
                    __html: singleLineRenderer(insight.insight),
                  }}
                />
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
                    icon={<IconEdit size="sm" />}
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
                  <ContextBody>
                    <p
                      ref={justificationRef}
                      dangerouslySetInnerHTML={{
                        __html: marked(
                          replaceHeadersWithBold(
                            insight.justification || t('No details here.')
                          )
                        ),
                      }}
                    />
                  </ContextBody>
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
                  !insight ? null : (
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
                    />
                  )
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
      addSuccessMessage(t('Thanks, rethinking this...'));
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
      retain_insight_card_index: insightCount - 1,
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
              icon={<IconAdd size="sm" />}
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
    background-color: ${p =>
      !p.isUserMessage ? p.theme.backgroundSecondary : 'inherit'};
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
  animation: fadeFromActive 1.2s ease-out;

  @keyframes fadeFromActive {
    from {
      background-color: ${p => p.theme.active};
      border-color: ${p => p.theme.active};
    }
    to {
      background-color: ${p => p.theme.background};
      border-color: ${p => p.theme.innerBorder};
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

  &.new-insight {
    animation: textFadeFromActive 1.2s ease-out;
  }

  @keyframes textFadeFromActive {
    from {
      color: ${p => p.theme.white};
    }
    to {
      color: inherit;
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

export default AutofixInsightCards;
