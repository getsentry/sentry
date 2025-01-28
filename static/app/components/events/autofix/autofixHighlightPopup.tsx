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
import {
  makeAutofixQueryKey,
  useAutofixData,
} from 'sentry/components/events/autofix/useAutofix';
import Input from 'sentry/components/input';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconChevron} from 'sentry/icons';
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
}

interface OptimisticMessage extends CommentThreadMessage {
  isLoading?: boolean;
}

function useCommentThread({groupId, runId}: {groupId: string; runId: string}) {
  const api = useApi({persistInFlight: true});
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: {
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

function AutofixHighlightPopupContent({
  selectedText,
  groupId,
  runId,
  stepIndex,
  retainInsightCardIndex,
}: Omit<Props, 'referenceElement'>) {
  const {mutate: submitComment} = useCommentThread({groupId, runId});
  const [comment, setComment] = useState('');
  const [threadId] = useState(() => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `thread-${timestamp}-${random}`;
  });
  const [optimisticMessages, setOptimisticMessages] = useState<OptimisticMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch current autofix data to get comment thread
  const autofixData = useAutofixData({groupId});
  const currentStep = autofixData?.steps?.[stepIndex];
  const commentThread =
    currentStep?.active_comment_thread?.id === threadId
      ? currentStep.active_comment_thread
      : null;
  const messages = useMemo(
    () => commentThread?.messages ?? [],
    [commentThread?.messages]
  );

  // Combine server messages with optimistic ones
  const allMessages = useMemo(() => {
    const serverMessageCount = messages.length;
    const relevantOptimisticMessages = optimisticMessages.slice(serverMessageCount);
    return [...messages, ...relevantOptimisticMessages];
  }, [messages, optimisticMessages]);

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

    // Add user message and loading assistant message immediately
    setOptimisticMessages(prev => [
      ...prev,
      {role: 'user', content: comment},
      {role: 'assistant', content: '', isLoading: true},
    ]);

    submitComment({
      message: comment,
      thread_id: threadId,
      selected_text: selectedText,
      step_index: stepIndex,
      retain_insight_card_index: retainInsightCardIndex,
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

  return (
    <Container onClick={handleContainerClick}>
      <Header>
        <SelectedText>
          <span>"{truncatedText}"</span>
        </SelectedText>
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

function AutofixHighlightPopup(props: Props) {
  const {referenceElement} = props;
  const popupRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({left: 0, top: 0});

  useLayoutEffect(() => {
    if (!referenceElement || !popupRef.current) {
      return undefined;
    }

    const updatePosition = () => {
      const rect = referenceElement.getBoundingClientRect();
      startTransition(() => {
        setPosition({
          left: rect.left - 320,
          top: rect.top,
        });
      });
    };

    // Initial position
    updatePosition();

    // Create observer to track reference element changes
    const resizeObserver = new ResizeObserver(updatePosition);
    resizeObserver.observe(referenceElement);

    // Track scroll events
    const scrollElements = [window, ...getScrollParents(referenceElement)];
    scrollElements.forEach(element => {
      element.addEventListener('scroll', updatePosition, {passive: true});
    });

    return () => {
      resizeObserver.disconnect();
      scrollElements.forEach(element => {
        element.removeEventListener('scroll', updatePosition);
      });
    };
  }, [referenceElement]);

  return createPortal(
    <Wrapper
      ref={popupRef}
      id="autofix-rethink-input"
      data-popup="autofix-highlight"
      initial={{opacity: 0, x: -10}}
      animate={{opacity: 1, x: 0}}
      exit={{opacity: 0, x: -10}}
      transition={testableTransition({
        duration: 0.2,
      })}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
        transform: 'none',
      }}
    >
      <Arrow />
      <ScaleContainer>
        <AutofixHighlightPopupContent {...props} />
      </ScaleContainer>
    </Wrapper>,
    document.body
  );
}

const Wrapper = styled(motion.div)`
  z-index: ${p => p.theme.zIndex.tooltip};
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
  gap: ${space(1)};
  padding: ${space(1)};
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
  background: ${p => p.theme.active}01;
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
