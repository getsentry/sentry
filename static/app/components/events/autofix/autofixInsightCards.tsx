import {useCallback, useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import {usePopper} from 'react-popper';
import styled from '@emotion/styled';
import {AnimatePresence, type AnimationProps, motion} from 'framer-motion';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/button';
import {replaceHeadersWithBold} from 'sentry/components/events/autofix/autofixRootCause';
import type {AutofixInsight} from 'sentry/components/events/autofix/types';
import {makeAutofixQueryKey} from 'sentry/components/events/autofix/useAutofix';
import Input from 'sentry/components/input';
import {Tooltip} from 'sentry/components/tooltip';
import {IconArrow, IconChevron, IconRefresh} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import marked, {singleLineRenderer} from 'sentry/utils/marked';
import {useMutation, useQueryClient} from 'sentry/utils/queryClient';
import testableTransition from 'sentry/utils/testableTransition';
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
  runId: string;
  stepIndex: number;
  isLastInsightInStep?: boolean;
  shouldHighlightRethink?: boolean;
}

function AutofixInsightCard({
  insight,
  hasCardBelow,
  hasCardAbove,
  index,
  stepIndex,
  groupId,
  runId,
  shouldHighlightRethink,
  isLastInsightInStep,
}: AutofixInsightCardProps) {
  const isUserMessage = insight.justification === 'USER';

  const [expanded, setExpanded] = useState(false);

  const toggleExpand = () => {
    setExpanded(oldState => !oldState);
  };

  return (
    <ContentWrapper>
      <AnimatePresence initial>
        <AnimationWrapper key="content" {...animationProps}>
          {hasCardAbove && (
            <ChainLink
              insightCardAboveIndex={index - 1}
              stepIndex={stepIndex}
              groupId={groupId}
              runId={runId}
              isHighlighted={shouldHighlightRethink}
            />
          )}
          {!isUserMessage && (
            <InsightContainer>
              <Tooltip
                title={t('Expand to see the evidence behind this insight')}
                skipWrapper
                disabled={expanded}
              >
                <InsightCardRow onClick={toggleExpand}>
                  <MiniHeader
                    dangerouslySetInnerHTML={{
                      __html: singleLineRenderer(insight.insight),
                    }}
                  />
                  <RightSection>
                    <StyledIconChevron
                      direction={expanded ? 'down' : 'right'}
                      size="sm"
                    />
                  </RightSection>
                </InsightCardRow>
              </Tooltip>

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
                    <ContextBody>
                      <p
                        dangerouslySetInnerHTML={{
                          __html: marked(replaceHeadersWithBold(insight.justification)),
                        }}
                      />
                    </ContextBody>
                  </motion.div>
                )}
              </AnimatePresence>
            </InsightContainer>
          )}
          {isUserMessage && (
            <UserMessageContainer>
              <UserMessage
                dangerouslySetInnerHTML={{
                  __html: singleLineRenderer(insight.insight),
                }}
              />
            </UserMessageContainer>
          )}
          {hasCardBelow && (
            <ChainLink
              insightCardAboveIndex={index}
              stepIndex={stepIndex}
              groupId={groupId}
              runId={runId}
              isHighlighted={shouldHighlightRethink}
              isLastCard={isLastInsightInStep}
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
  shouldHighlightRethink?: boolean;
}

function AutofixInsightCards({
  insights,
  hasStepBelow,
  hasStepAbove,
  stepIndex,
  groupId,
  runId,
  shouldHighlightRethink,
}: AutofixInsightCardsProps) {
  return (
    <InsightsContainer>
      {insights.length > 0 ? (
        insights.map((insight, index) =>
          !insight ? null : (
            <AutofixInsightCard
              key={index}
              insight={insight}
              hasCardBelow={index < insights.length - 1 || hasStepBelow}
              hasCardAbove={hasStepAbove && index === 0}
              index={index}
              stepIndex={stepIndex}
              groupId={groupId}
              runId={runId}
              isLastInsightInStep={index === insights.length - 1}
              shouldHighlightRethink={shouldHighlightRethink}
            />
          )
        )
      ) : stepIndex === 0 && !hasStepBelow ? (
        <NoInsightsYet />
      ) : hasStepBelow ? (
        <EmptyResultsContainer>
          <ChainLink
            insightCardAboveIndex={null}
            stepIndex={stepIndex}
            groupId={groupId}
            runId={runId}
            isHighlighted={shouldHighlightRethink}
            isLastCard
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

function ChainLink({
  groupId,
  runId,
  stepIndex,
  insightCardAboveIndex,
  isHighlighted,
  isLastCard,
}: {
  groupId: string;
  insightCardAboveIndex: number | null;
  runId: string;
  stepIndex: number;
  isHighlighted?: boolean;
  isLastCard?: boolean;
}) {
  const [showOverlay, setShowOverlay] = useState(false);
  const [referenceElement, setReferenceElement] = useState<
    HTMLAnchorElement | HTMLButtonElement | null
  >(null);
  const [popperElement, setPopperElement] = useState<HTMLDivElement | null>(null);
  const [comment, setComment] = useState('');
  const {mutate: send} = useUpdateInsightCard({groupId, runId});

  const {styles, attributes} = usePopper(referenceElement, popperElement, {
    placement: 'left-start',
    modifiers: [
      {
        name: 'offset',
        options: {
          offset: [-16, 8],
        },
      },
      {
        name: 'flip',
        options: {
          fallbackPlacements: ['right-start', 'bottom-start'],
        },
      },
    ],
  });

  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (
        referenceElement?.contains(event.target as Node) ||
        popperElement?.contains(event.target as Node)
      ) {
        return;
      }
      setShowOverlay(false);
    },
    [popperElement, referenceElement]
  );

  useEffect(() => {
    if (showOverlay) {
      document.addEventListener('mousedown', handleClickOutside);
    } else {
      document.removeEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showOverlay, handleClickOutside]);

  return (
    <ArrowContainer>
      <IconArrow direction={'down'} className="arrow-icon" />
      <RethinkButtonContainer className="rethink-button-container">
        <AnimatePresence>
          {isLastCard && isHighlighted && (
            <RethinkMessage
              initial={{opacity: 0, x: 20}}
              animate={{opacity: 1, x: 0}}
              exit={{opacity: 0, x: 20}}
              transition={{duration: 0.4}}
            >
              {t('Did we go wrong somewhere? →')}
            </RethinkMessage>
          )}
        </AnimatePresence>
        <RethinkButton
          ref={setReferenceElement}
          icon={<IconRefresh size="sm" />}
          size="zero"
          className="rethink-button"
          title={t('Rethink from here')}
          aria-label={t('Rethink from here')}
          onClick={() => setShowOverlay(true)}
          isHighlighted={isHighlighted}
        />
      </RethinkButtonContainer>

      {showOverlay &&
        createPortal(
          <RethinkInput
            ref={setPopperElement}
            style={styles.popper}
            {...attributes.popper}
            id="autofix-rethink-input"
          >
            <form
              onSubmit={e => {
                e.preventDefault();
                e.stopPropagation();
                setShowOverlay(false);
                setComment('');
                send({
                  message: comment,
                  step_index: stepIndex,
                  retain_insight_card_index: insightCardAboveIndex,
                });
              }}
              className="row-form"
              onClick={e => e.stopPropagation()}
              id="autofix-rethink-input"
            >
              <Input
                type="text"
                placeholder="You should know X... Dive deeper into Y... Look at Z..."
                value={comment}
                onChange={e => setComment(e.target.value)}
                size="md"
                autoFocus
                id="autofix-rethink-input"
              />
              <Button
                type="submit"
                icon={<IconRefresh />}
                title="Restart analysis from this point in the chain"
                aria-label="Restart analysis from this point in the chain"
                priority="primary"
                size="md"
                id="autofix-rethink-input"
              />
            </form>
          </RethinkInput>,
          document.querySelector('.solutions-drawer-container') ?? document.body
        )}
    </ArrowContainer>
  );
}

const InsightCardRow = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: stretch;
  cursor: pointer;
  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;

const UserMessageContainer = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  display: flex;
  align-items: center;
  overflow: hidden;
  margin-left: ${space(4)};
  margin-right: ${space(4)};
`;

const UserMessage = styled('div')`
  margin-left: ${space(2)};
  flex-shrink: 100;
  word-break: break-word;
`;

const NoInsightsYet = styled('div')`
  display: flex;
  justify-content: center;
  flex-direction: column;
  color: ${p => p.theme.subText};
`;

const EmptyResultsContainer = styled('div')`
  position: relative;
  bottom: -${space(1)};
`;

const InsightsContainer = styled('div')``;

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

const ArrowContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  color: ${p => `${p.theme.active}99`};
  align-items: center;
  position: relative;
  z-index: 0;
  padding-top: ${space(0.5)};
  padding-bottom: ${space(0.75)};

  .arrow-icon {
    grid-column: 2 / 3;
    justify-self: center;
    align-self: center;
  }

  .rethink-button-container {
    grid-column: 3 / 4;
    justify-self: end;
    align-self: center;
    position: relative;
    margin-right: ${space(1)};
  }
`;

const RethinkButtonContainer = styled('div')`
  position: relative;
`;

const RethinkMessage = styled(motion.div)`
  color: ${p => p.theme.pink400};
  font-size: ${p => p.theme.fontSizeSmall};
  position: absolute;
  right: calc(100% + ${space(1)});
  margin-top: 1px;
  white-space: nowrap;
`;

const RethinkButton = styled(Button)<{isHighlighted?: boolean}>`
  font-weight: normal;
  font-size: small;
  border: none;
  color: ${p => p.theme.pink400}80;
  transition: all 0.4s ease-in-out;
  position: relative;

  ${p =>
    p.isHighlighted &&
    `
    color: ${p.theme.pink400};
    border-radius: ${p.theme.borderRadius};

    &:hover {
      color: ${p.theme.pink400};
      background: ${p.theme.pink400}20;
    }
  `}

  &:hover {
    transform: scale(1.05);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const RethinkInput = styled('div')`
  position: fixed;
  box-shadow: ${p => p.theme.dropShadowHeavy};
  border: 1px solid ${p => p.theme.border};
  width: 90%;
  background: ${p => p.theme.background}
    linear-gradient(
      to left,
      ${p => p.theme.backgroundElevated},
      ${p => p.theme.pink400}20
    );
  padding: ${space(0.5)};
  border-radius: ${p => p.theme.borderRadius};
  z-index: ${p => p.theme.zIndex.tooltip};

  .row-form {
    display: flex;
    gap: ${space(1)};
  }
`;

const ContentWrapper = styled('div')``;

const MiniHeader = styled('p')`
  padding-top: ${space(0.5)};
  padding-bottom: ${space(0.5)};
  padding-left: ${space(2)};
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
    linear-gradient(135deg, ${p => p.theme.background}, ${p => p.theme.pink400}20);
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
  color: ${p => p.theme.pink400}80;
`;

const RightSection = styled('div')`
  display: flex;
  align-items: center;
  padding-right: ${space(1)};
`;

export default AutofixInsightCards;
