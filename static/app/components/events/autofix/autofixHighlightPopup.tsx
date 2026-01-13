import React, {
  Fragment,
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {createPortal} from 'react-dom';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {AnimatePresence, motion} from 'framer-motion';

import {addErrorMessage, addLoadingMessage} from 'sentry/actionCreators/indicator';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import {TextArea} from 'sentry/components/core/textarea';
import {FlippedReturnIcon} from 'sentry/components/events/autofix/insights/autofixInsightCard';
import {
  makeAutofixQueryKey,
  useAutofixData,
} from 'sentry/components/events/autofix/useAutofix';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconClose, IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {MarkedText} from 'sentry/utils/marked/markedText';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import useMedia from 'sentry/utils/useMedia';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {Divider} from 'sentry/views/issueDetails/divider';

import type {CommentThreadMessage} from './types';

interface Props {
  groupId: string;
  referenceElement: HTMLElement | null;
  retainInsightCardIndex: number | null;
  runId: string;
  selectedText: string;
  stepIndex: number;
  blockName?: string;
  hasUserSelection?: boolean;
  isAgentComment?: boolean;
  onShouldPersistChange?: (shouldPersist: boolean) => void;
}

interface OptimisticMessage extends CommentThreadMessage {
  isLoading?: boolean;
}

const MIN_LEFT_MARGIN = 8;

function useCommentThread({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const orgSlug = useOrganization().slug;

  return useMutation({
    mutationFn: (params: {
      is_agent_comment: boolean;
      message: string;
      retain_insight_card_index: number | null;
      selected_text: string;
      step_index: number;
      thread_id: string;
    }) => {
      return api.requestPromise(
        `/organizations/${orgSlug}/issues/${groupId}/autofix/update/`,
        {
          method: 'POST',
          data: {
            run_id: runId,
            payload: {
              type: 'comment_thread',
              message: params.message,
              thread_id: params.thread_id,
              selected_text: params.selected_text,
              step_index: params.step_index,
              retain_insight_card_index: params.retain_insight_card_index,
              is_agent_comment: params.is_agent_comment,
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
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when sending your comment.'));
    },
  });
}

function useCloseCommentThread({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const orgSlug = useOrganization().slug;

  return useMutation({
    mutationFn: (params: {
      is_agent_comment: boolean;
      step_index: number;
      thread_id: string;
    }) => {
      return api.requestPromise(
        `/organizations/${orgSlug}/issues/${groupId}/autofix/update/`,
        {
          method: 'POST',
          data: {
            run_id: runId,
            payload: {
              type: 'resolve_comment_thread',
              thread_id: params.thread_id,
              step_index: params.step_index,
              is_agent_comment: params.is_agent_comment,
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
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when resolving the thread.'));
    },
  });
}

function useRethinkWithCommentThread({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();
  const orgSlug = useOrganization().slug;

  return useMutation({
    mutationFn: (params: {
      is_agent_comment: boolean;
      retain_insight_card_index: number | null;
      selected_text: string;
      step_index: number;
      thread_id: string;
    }) => {
      return api.requestPromise(
        `/organizations/${orgSlug}/issues/${groupId}/autofix/update/`,
        {
          method: 'POST',
          data: {
            run_id: runId,
            payload: {
              type: 'rethink_with_comment_thread',
              thread_id: params.thread_id,
              step_index: params.step_index,
              is_agent_comment: params.is_agent_comment,
              selected_text: params.selected_text,
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
      addLoadingMessage(t('Rethinking based on this thread...'));
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when rethinking with the thread.'));
    },
  });
}

function AutofixHighlightPopupContent({
  selectedText,
  groupId,
  runId,
  stepIndex,
  retainInsightCardIndex,
  isAgentComment,
  blockName,
  isFocused,
  hasUserSelection,
  onShouldPersistChange,
}: Props & {isFocused?: boolean}) {
  const organization = useOrganization();

  const {mutate: submitComment} = useCommentThread({groupId, runId});
  const {mutate: closeCommentThread} = useCloseCommentThread({groupId, runId});
  const {mutate: rethinkWithCommentThread} = useRethinkWithCommentThread({
    groupId,
    runId,
  });

  const [hidden, setHidden] = useState(false);
  const [comment, setComment] = useState('');
  const [threadId] = useState(() => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `thread-${timestamp}-${random}`;
  });
  const [pendingUserMessage, setPendingUserMessage] = useState<OptimisticMessage | null>(
    null
  );
  const [showLoadingAssistant, setShowLoadingAssistant] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch current autofix data to get comment thread
  const {data: autofixData} = useAutofixData({groupId, isUserWatching: true});
  const currentStep = isAgentComment
    ? autofixData?.steps?.[stepIndex + 1]
    : autofixData?.steps?.[stepIndex];

  const commentThread = isAgentComment
    ? currentStep?.agent_comment_thread
    : currentStep?.active_comment_thread?.id === threadId
      ? currentStep.active_comment_thread
      : null;

  const serverMessages = useMemo(
    () => commentThread?.messages ?? [],
    [commentThread?.messages]
  );

  // Effect to clear pending messages when server data updates
  useEffect(() => {
    if (serverMessages.length > 0) {
      const lastServerMessage = serverMessages[serverMessages.length - 1];

      // If the last server message is from the assistant, clear all pending messages
      if (lastServerMessage && lastServerMessage.role === 'assistant') {
        setPendingUserMessage(null);
        setShowLoadingAssistant(false);
      }

      // If the last server message is from the user, keep loading assistant state
      // but clear the pending user message
      if (lastServerMessage && lastServerMessage.role === 'user') {
        setPendingUserMessage(null);
        setShowLoadingAssistant(true);
      }
    }
  }, [serverMessages]);

  // Combine server messages with optimistic ones
  const allMessages = useMemo(() => {
    const result = [...serverMessages];

    // Add pending user message if it exists
    if (pendingUserMessage) {
      result.push(pendingUserMessage);
    }

    // Add loading assistant message if needed
    if (showLoadingAssistant) {
      result.push({
        role: 'assistant' as const,
        content: '',
        isLoading: true,
      });
    }

    return result;
  }, [serverMessages, pendingUserMessage, showLoadingAssistant]);

  const truncatedText =
    selectedText.length > 35
      ? selectedText.slice(0, 35).split(' ').slice(0, -1).join(' ') + '...'
      : selectedText;

  const currentUser = useUser();

  const hasLoadingMessage = useMemo(
    () => allMessages.some(msg => msg.role === 'assistant' && msg.isLoading),
    [allMessages]
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim() || hasLoadingMessage) {
      return;
    }

    // Add optimistic user message and show loading assistant
    setPendingUserMessage({role: 'user', content: comment});
    setShowLoadingAssistant(true);

    submitComment({
      message: comment,
      thread_id: threadId,
      selected_text: selectedText,
      step_index: stepIndex,
      retain_insight_card_index: retainInsightCardIndex,
      is_agent_comment: isAgentComment ?? false,
    });
    setComment('');

    trackAnalytics('autofix.comment_thread.submit', {
      organization,
      group_id: groupId,
      run_id: runId,
      step_index: stepIndex,
      is_agent_comment: isAgentComment ?? false,
    });
  };

  const handleContainerClick = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({behavior: 'smooth'});
  };

  // Add effect to scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom();
  }, [allMessages]);

  const handleResolve = (e: React.MouseEvent) => {
    e.stopPropagation();
    resolveThread();
  };

  const resolveThread = () => {
    setHidden(true);
    closeCommentThread({
      thread_id: threadId,
      step_index: stepIndex,
      is_agent_comment: isAgentComment ?? false,
    });
  };

  const handleRework = (e: React.MouseEvent) => {
    e.stopPropagation();
    rethinkWithCommentThread({
      thread_id: threadId,
      step_index: stepIndex,
      is_agent_comment: isAgentComment ?? false,
      selected_text: selectedText,
      retain_insight_card_index: retainInsightCardIndex,
    });

    trackAnalytics('autofix.comment_thread.rework', {
      organization,
      group_id: groupId,
      run_id: runId,
      step_index: stepIndex,
      is_agent_comment: isAgentComment ?? false,
    });
  };

  useEffect(() => {
    if (onShouldPersistChange) {
      onShouldPersistChange(!!commentThread && commentThread.is_completed !== true);
    }
  }, [commentThread, onShouldPersistChange]);

  if (hidden) {
    return null;
  }

  return (
    <Fragment>
      <Arrow />
      <Container onClick={handleContainerClick} isFocused={isFocused}>
        <Header>
          <AnimatePresence mode="wait">
            {allMessages.filter(msg => !msg.isLoading).length >= 2 ? (
              <motion.div
                key="rework-header"
                initial={{opacity: 0, y: 10}}
                animate={{opacity: 1, y: 0}}
                exit={{opacity: 0, y: -10}}
                transition={{duration: 0.2, ease: 'easeInOut'}}
                style={{display: 'flex', alignItems: 'center', width: '100%'}}
              >
                <ReworkHeaderSection onClick={handleRework}>
                  <ReworkText>{t('Rethink based on this convo?')}</ReworkText>

                  <ReworkArrow
                    title={t(
                      'Seer will use this chat as context to re-work its analysis from this point.'
                    )}
                  >
                    <FlippedReturnIcon />
                  </ReworkArrow>
                </ReworkHeaderSection>
                <HeaderRight>
                  <Divider />
                  <ResolveButton
                    size="zero"
                    borderless
                    aria-label={t('Resolve thread')}
                    onClick={handleResolve}
                    icon={<IconClose size="xs" />}
                  />
                </HeaderRight>
              </motion.div>
            ) : (
              <motion.div
                key="selected-text-header"
                initial={{opacity: 0, y: 10}}
                animate={{opacity: 1, y: 0}}
                exit={{opacity: 0, y: -10}}
                transition={{duration: 0.2, ease: 'easeInOut'}}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  width: '100%',
                }}
              >
                <SelectedText>
                  {blockName ? (
                    <span>{blockName}</span>
                  ) : (
                    truncatedText && <span>"{truncatedText}"</span>
                  )}
                </SelectedText>
                {allMessages.length > 0 && (
                  <ResolveButton
                    size="zero"
                    borderless
                    aria-label={t('Resolve thread')}
                    onClick={handleResolve}
                    icon={<IconClose size="xs" />}
                  />
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </Header>

        {allMessages.length > 0 && (
          <MessagesContainer>
            {allMessages.map((message, i) => (
              <Message key={i} role={message.role}>
                {message.role === 'assistant' ? (
                  <CircularSeerIcon>
                    <IconSeer />
                  </CircularSeerIcon>
                ) : (
                  <UserAvatar user={currentUser} size={24} />
                )}
                <MessageContent>
                  {message.isLoading ? (
                    <LoadingWrapper>
                      <LoadingIndicator mini size={12} />
                    </LoadingWrapper>
                  ) : (
                    <MarkedText text={message.content} inline />
                  )}
                </MessageContent>
              </Message>
            ))}
            <div ref={messagesEndRef} />
          </MessagesContainer>
        )}

        {commentThread?.is_completed !== true && (
          <Fragment>
            <InputWrapper onSubmit={handleSubmit}>
              <StyledInput
                placeholder={
                  isAgentComment
                    ? t('Share your context...')
                    : t('Questions? Instructions?')
                }
                value={comment}
                onChange={e => setComment(e.target.value)}
                maxLength={4096}
                size="sm"
                autoFocus={!isAgentComment && !hasUserSelection}
                maxRows={5}
                autosize
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit(e);
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    resolveThread();
                  }
                }}
              />
              <StyledButton
                size="zero"
                type="submit"
                borderless
                aria-label={t('Submit Comment')}
              >
                {'\u23CE'}
              </StyledButton>
            </InputWrapper>
          </Fragment>
        )}
      </Container>
    </Fragment>
  );
}

function getOptimalPosition(
  referenceRect: DOMRect,
  popupRect: DOMRect,
  drawerWidth?: number
) {
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  const effectiveDrawerWidth = drawerWidth ?? viewportWidth * 0.5;

  // Calculate initial position to the left of the drawer
  let left = viewportWidth - effectiveDrawerWidth - popupRect.width - 8;

  // Ensure the popup is not cut off on the left side
  if (left < MIN_LEFT_MARGIN) {
    left = MIN_LEFT_MARGIN;
  }

  let top = referenceRect.top;

  // Ensure the popup stays within the viewport vertically
  if (top + popupRect.height > viewportHeight) {
    top = viewportHeight - popupRect.height;
  }
  if (top < 42) {
    top = 42;
  }

  return {left, top};
}

function AutofixHighlightPopup(props: Props) {
  const {referenceElement} = props;
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
  }>({
    left: 0,
    top: 0,
  });
  const [width, setWidth] = useState<number | undefined>(undefined);
  const [isFocused, setIsFocused] = useState(false);

  const theme = useTheme();
  const isSmallScreen = useMedia(`(max-width: ${theme.breakpoints.sm})`);

  useLayoutEffect(() => {
    if (!referenceElement || !popupRef.current) {
      return undefined;
    }

    const updatePosition = () => {
      if (!referenceElement || !popupRef.current) {
        return;
      }

      const referenceRect = referenceElement.getBoundingClientRect();
      const popupRect = popupRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;

      const drawerElement = document.querySelector('.drawer-panel');
      const drawerWidth = drawerElement
        ? drawerElement.getBoundingClientRect().width
        : undefined;

      // Calculate available width for the popup
      const availableWidth = viewportWidth - (drawerWidth ?? viewportWidth * 0.5) - 16;
      const defaultWidth = 300;
      const newWidth = Math.min(defaultWidth, Math.max(200, availableWidth));

      startTransition(() => {
        setPosition(getOptimalPosition(referenceRect, popupRect, drawerWidth));
        setWidth(newWidth);
      });
    };

    // Initial position
    updatePosition();

    // Create observers to track both elements
    const referenceObserver = new ResizeObserver(updatePosition);
    const popupObserver = new ResizeObserver(updatePosition);

    referenceObserver.observe(referenceElement);
    popupObserver.observe(popupRef.current);

    // Track scroll events
    const scrollElements = [window, ...getScrollParents(referenceElement)];
    scrollElements.forEach(element => {
      element.addEventListener('scroll', updatePosition, {passive: true});
    });

    // Track window resize
    window.addEventListener('resize', updatePosition, {passive: true});

    return () => {
      referenceObserver.disconnect();
      popupObserver.disconnect();
      scrollElements.forEach(element => {
        element.removeEventListener('scroll', updatePosition);
      });
      window.removeEventListener('resize', updatePosition);
    };
  }, [referenceElement]);

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  if (isSmallScreen) {
    return null;
  }

  return createPortal(
    <Wrapper
      ref={popupRef}
      data-popup="autofix-highlight"
      data-autofix-input-type={props.isAgentComment ? 'agent-comment' : 'rethink'}
      initial={{opacity: 0, x: 10}}
      animate={{opacity: 1, x: 0}}
      exit={{opacity: 0, x: 10}}
      transition={testableTransition({
        duration: 0.2,
      })}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        width: width ? `${width}px` : '300px',
      }}
      isFocused={isFocused}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={-1}
    >
      <ScaleContainer isFocused={isFocused}>
        <AutofixHighlightPopupContent {...props} isFocused={isFocused} />
      </ScaleContainer>
    </Wrapper>,
    document.body
  );
}

const Wrapper = styled(motion.div)<{isFocused?: boolean}>`
  z-index: ${p => (p.isFocused ? p.theme.zIndex.tooltip + 1 : p.theme.zIndex.tooltip)};
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-right: ${space(1)};
  gap: ${space(1)};
  max-width: 300px;
  min-width: 200px;
  position: fixed;
  will-change: transform;
`;

const ScaleContainer = styled(motion.div)<{isFocused?: boolean}>`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  transform-origin: top right;
  padding-left: ${space(2)};
  transform: scale(${p => (p.isFocused ? 1 : 0.9)});
  transition: transform 200ms ease;
`;

const Container = styled(motion.div, {
  shouldForwardProp: prop => prop !== 'isFocused',
})<{isFocused?: boolean}>`
  position: relative;
  width: 100%;
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
  border: 1px dashed ${p => p.theme.tokens.border.primary};
  overflow: hidden;
  box-shadow: ${p => (p.isFocused ? p.theme.dropShadowHeavy : p.theme.dropShadowLight)};
  transition: box-shadow 200ms ease;

  &:before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      color-mix(
        in srgb,
        ${p => p.theme.tokens.interactive.link.accent.active} 12.5%,
        transparent
      ),
      transparent
    );
    background-size: 2000px 100%;
    pointer-events: none;
  }
`;

const InputWrapper = styled('form')`
  display: flex;
  padding: ${space(0.5)};
  background: ${p => p.theme.backgroundSecondary};
  position: relative;
`;

const StyledInput = styled(TextArea)`
  flex-grow: 1;
  border-color: ${p => p.theme.tokens.border.secondary};
  padding-right: ${space(4)};
  padding-top: ${space(0.75)};
  padding-bottom: ${space(0.75)};
  resize: none;

  &:hover {
    border-color: ${p => p.theme.tokens.border.primary};
  }
`;

const StyledButton = styled(Button)`
  position: absolute;
  right: ${space(1)};
  top: 50%;
  transform: translateY(-50%);
  height: 24px;
  width: 24px;
  margin-right: 0;
  color: ${p => p.theme.tokens.content.secondary};
  z-index: 2;
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1)} ${space(1.5)};
  background: ${p => p.theme.backgroundSecondary};
  word-break: break-word;
  overflow-wrap: break-word;
`;

const SelectedText = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};
  align-items: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const Arrow = styled('div')`
  position: absolute;
  width: 12px;
  height: 12px;
  background: ${p => p.theme.backgroundSecondary};
  border: 1px dashed ${p => p.theme.tokens.border.primary};
  border-right: none;
  border-bottom: none;
  top: 20px;
  right: -6px;
  transform: rotate(135deg);
  z-index: 1;
`;

const MessagesContainer = styled('div')`
  padding: ${space(1)};
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  max-height: 200px;
  overflow-y: auto;
  scroll-behavior: smooth;
`;

const Message = styled('div')<{role: CommentThreadMessage['role']}>`
  display: flex;
  gap: ${space(1)};
  align-items: flex-start;
`;

const MessageContent = styled('div')`
  flex-grow: 1;
  border-radius: ${p => p.theme.radius.md};
  padding-top: ${space(0.5)};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.primary};
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: pre-wrap;

  code {
    font-size: ${p => p.theme.fontSize.xs};
    background: transparent;
  }
`;

const CircularSeerIcon = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${p => p.theme.tokens.background.accent.vibrant};
  flex-shrink: 0;

  > svg {
    width: 18px;
    height: 18px;
    color: ${p => p.theme.tokens.content.onVibrant.light};
  }
`;

const LoadingWrapper = styled('div')`
  display: flex;
  align-items: center;
  height: 24px;
  margin-top: ${space(0.25)};
`;

const ResolveButton = styled(Button)`
  margin-left: ${space(1)};
`;

const ReworkHeaderSection = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  transition: opacity 0.2s ease;
  flex: 1;
`;

const HeaderRight = styled('div')`
  display: flex;
  align-items: center;
  padding-left: ${p => p.theme.space.lg};
`;

const ReworkText = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.tokens.content.secondary};

  ${ReworkHeaderSection}:hover & {
    color: ${p => p.theme.tokens.content.primary};
  }
`;

const ReworkArrow = styled('div')`
  display: flex;
  align-items: center;
  transition: transform 0.2s ease;

  ${ReworkHeaderSection}:hover & {
    transform: translateX(2px);
  }
`;

function getScrollParents(element: HTMLElement): Element[] {
  const scrollParents: Element[] = [];
  let currentElement = element.parentElement;

  while (currentElement) {
    const overflow = window.getComputedStyle(currentElement).overflow;
    if (overflow.includes('scroll') || overflow.includes('auto')) {
      scrollParents.push(currentElement);
    }
    currentElement = currentElement.parentElement;
  }

  return scrollParents;
}

export default AutofixHighlightPopup;
