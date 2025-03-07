import {
  startTransition,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {createPortal} from 'react-dom';
import styled from '@emotion/styled';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {motion} from 'framer-motion';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {SeerIcon} from 'sentry/components/ai/SeerIcon';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import {Button} from 'sentry/components/button';
import {Input} from 'sentry/components/core/input';
import {
  makeAutofixQueryKey,
  useAutofixData,
} from 'sentry/components/events/autofix/useAutofix';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconChevron, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import {useUser} from 'sentry/utils/useUser';

import type {CommentThreadMessage} from './types';

interface Props {
  groupId: string;
  referenceElement: HTMLElement | null;
  retainInsightCardIndex: number | null;
  runId: string;
  selectedText: string;
  stepIndex: number;
  isAgentComment?: boolean;
}

interface OptimisticMessage extends CommentThreadMessage {
  isLoading?: boolean;
}

function useCommentThread({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      is_agent_comment: boolean;
      message: string;
      retain_insight_card_index: number | null;
      selected_text: string;
      step_index: number;
      thread_id: string;
    }) => {
      return api.requestPromise(`/issues/${groupId}/autofix/update/`, {
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
      });
    },
    onSuccess: _ => {
      queryClient.invalidateQueries({queryKey: makeAutofixQueryKey(groupId)});
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when sending your comment.'));
    },
  });
}

function useCloseCommentThread({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
      is_agent_comment: boolean;
      step_index: number;
      thread_id: string;
    }) => {
      return api.requestPromise(`/issues/${groupId}/autofix/update/`, {
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
      });
    },
    onSuccess: _ => {
      queryClient.invalidateQueries({queryKey: makeAutofixQueryKey(groupId)});
    },
    onError: () => {
      addErrorMessage(t('Something went wrong when resolving the thread.'));
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
}: Props) {
  const {mutate: submitComment} = useCommentThread({groupId, runId});
  const {mutate: closeCommentThread} = useCloseCommentThread({groupId, runId});

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
  const autofixData = useAutofixData({groupId});
  const currentStep = !isAgentComment
    ? autofixData?.steps?.[stepIndex]
    : autofixData?.steps?.[stepIndex + 1];

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
    selectedText.length > 70
      ? selectedText.slice(0, 35).split(' ').slice(0, -1).join(' ') +
        '... ...' +
        selectedText.slice(-35)
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
    closeCommentThread({
      thread_id: threadId,
      step_index: stepIndex,
      is_agent_comment: isAgentComment ?? false,
    });
  };

  return (
    <Container onClick={handleContainerClick}>
      <Header>
        <SelectedText>
          <span>"{truncatedText}"</span>
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
      </Header>

      {allMessages.length > 0 && (
        <MessagesContainer>
          {allMessages.map((message, i) => (
            <Message key={i} role={message.role}>
              {message.role === 'assistant' ? (
                <CircularSeerIcon>
                  <SeerIcon />
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
                  message.content
                )}
              </MessageContent>
            </Message>
          ))}
          <div ref={messagesEndRef} />
        </MessagesContainer>
      )}

      {commentThread?.is_completed !== true && (
        <InputWrapper onSubmit={handleSubmit}>
          <StyledInput
            placeholder={t('Questions or comments?')}
            value={comment}
            onChange={e => setComment(e.target.value)}
            size="sm"
            autoFocus
          />
          <StyledButton
            size="zero"
            type="submit"
            borderless
            aria-label={t('Submit Comment')}
          >
            <IconChevron direction="right" />
          </StyledButton>
        </InputWrapper>
      )}
    </Container>
  );
}

function getOptimalPosition(referenceRect: DOMRect, popupRect: DOMRect, spacing = 36) {
  const viewportHeight = window.innerHeight;

  // Try positioning to the left first (default)
  const left = referenceRect.left - popupRect.width - spacing;
  let top = referenceRect.top;

  // Ensure the popup stays within the viewport vertically
  if (top + popupRect.height > viewportHeight) {
    top = viewportHeight - popupRect.height;
  }
  if (top < 0) {
    top = 0;
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
  const [isFocused, setIsFocused] = useState(false);

  useLayoutEffect(() => {
    if (!referenceElement || !popupRef.current) {
      return undefined;
    }

    const updatePosition = () => {
      const referenceRect = referenceElement.getBoundingClientRect();
      const popupRect = popupRef.current!.getBoundingClientRect();

      startTransition(() => {
        setPosition(getOptimalPosition(referenceRect, popupRect));
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

  return createPortal(
    <Wrapper
      ref={popupRef}
      data-popup="autofix-highlight"
      data-autofix-input-type={!props.isAgentComment ? 'rethink' : 'agent-comment'}
      initial={{opacity: 0, x: 10}}
      animate={{opacity: 1, x: 0}}
      exit={{opacity: 0, x: 10}}
      transition={testableTransition({
        duration: 0.2,
      })}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
      }}
      isFocused={isFocused}
      onFocus={handleFocus}
      onBlur={handleBlur}
      tabIndex={-1}
    >
      <Arrow />
      <ScaleContainer>
        <AutofixHighlightPopupContent {...props} />
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
  width: 300px;
  position: fixed;
  will-change: transform;
`;

const ScaleContainer = styled(motion.div)`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  transform-origin: top left;
  padding-left: ${space(2)};
`;

const Container = styled(motion.div)`
  position: relative;
  width: 100%;
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.background};
  border: 1px dashed ${p => p.theme.border};
  overflow: hidden;
  box-shadow: ${p => p.theme.dropShadowHeavy};

  &:before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      transparent,
      ${p => p.theme.active}20,
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

const StyledInput = styled(Input)`
  flex-grow: 1;
  background: ${p => p.theme.background}
    linear-gradient(to left, ${p => p.theme.background}, ${p => p.theme.pink400}20);
  border-color: ${p => p.theme.innerBorder};
  padding-right: ${space(4)};

  &:hover {
    border-color: ${p => p.theme.border};
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
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  display: flex;
  align-items: center;

  span {
    overflow: wrap;
    white-space: wrap;
  }
`;

const Arrow = styled('div')`
  position: absolute;
  width: 12px;
  height: 12px;
  background: ${p => p.theme.backgroundSecondary};
  border: 1px dashed ${p => p.theme.border};
  border-right: none;
  border-bottom: none;
  top: 20px;
  right: -6px;
  transform: rotate(135deg);
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
  border-radius: ${p => p.theme.borderRadius};
  padding-top: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.textColor};
  word-break: break-word;
  overflow-wrap: break-word;
`;

const CircularSeerIcon = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: ${p => p.theme.purple300};
  flex-shrink: 0;

  > svg {
    width: 14px;
    height: 14px;
    color: ${p => p.theme.white};
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
