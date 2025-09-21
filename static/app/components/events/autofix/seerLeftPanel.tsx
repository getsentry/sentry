import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useMutation, useQueryClient} from '@tanstack/react-query';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Button} from 'sentry/components/core/button';
import {TextArea} from 'sentry/components/core/textarea';
import type {AutofixData} from 'sentry/components/events/autofix/types';
import {makeAutofixQueryKey} from 'sentry/components/events/autofix/useAutofix';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {MarkedText} from 'sentry/utils/marked/markedText';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface SeerLeftPanelProps {
  groupId: string;
  autofixData?: AutofixData;
}

type ChatDisplayMessage = {
  content: string;
  role: 'user' | 'assistant';
  isLoading?: boolean;
};

// Removes leading quoted preface like:
// "Quoting this insight you wrote: ["..."]\n\n<user message>"
function stripQuotedUserPrefix(text: string): string {
  const QUOTED_PREFIX_RE =
    /^Quoting this insight you wrote:\s*\[\s*["“][\s\S]*?["”]\s*\]\s*(?:\r?\n){1,2}/i;
  return text.replace(QUOTED_PREFIX_RE, '');
}

export function SeerLeftPanel({autofixData, groupId}: SeerLeftPanelProps) {
  const api = useApi({persistInFlight: true});
  const orgSlug = useOrganization().slug;
  const queryClient = useQueryClient();
  const [comment, setComment] = useState('');
  const [isInputFocused, setIsInputFocused] = useState(false);
  const [pendingUserMessage, setPendingUserMessage] = useState<ChatDisplayMessage | null>(
    null
  );
  const [showLoadingAssistant, setShowLoadingAssistant] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [selectedPreview, setSelectedPreview] = useState<{
    text: string;
    displayName?: string;
  } | null>(null);

  const serverMessages: ChatDisplayMessage[] = useMemo(
    () =>
      (autofixData?.chat ?? [])
        .filter(msg => msg.role !== 'tool_use' && msg.role !== 'tool')
        .map(msg => ({
          content: msg.content,
          role: msg.role === 'user' ? 'user' : 'assistant',
        })),
    [autofixData]
  );

  const {mutate: submitChat} = useMutation({
    mutationFn: (params: {message: string; runId: string; quotedText?: string}) => {
      return api.requestPromise(
        `/organizations/${orgSlug}/issues/${groupId}/autofix/update/`,
        {
          method: 'POST',
          data: {
            run_id: params.runId,
            payload: {
              type: 'chat',
              message: params.message,
              quoted_text: params.quotedText,
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
      addErrorMessage(t('Something went wrong when sending your message.'));
    },
  });

  // Track previous server message signature to reconcile optimistic state on any content change
  const computeSignature = (msgs: ChatDisplayMessage[]) =>
    JSON.stringify(msgs.map(m => [m.role, m.content]));
  const prevServerSignatureRef = useRef<string>(computeSignature(serverMessages));

  // Clear/adjust optimistic state whenever the server messages change (by length or content)
  useEffect(() => {
    const prevSig = prevServerSignatureRef.current;
    const currSig = computeSignature(serverMessages);

    if (currSig !== prevSig && (pendingUserMessage || showLoadingAssistant)) {
      const last = serverMessages[serverMessages.length - 1];
      if (last) {
        if (last.role === 'assistant') {
          setPendingUserMessage(null);
          setShowLoadingAssistant(false);
        } else if (last.role === 'user') {
          setPendingUserMessage(null);
          setShowLoadingAssistant(true);
        }
      }
    }
    prevServerSignatureRef.current = currSig;
  }, [serverMessages, pendingUserMessage, showLoadingAssistant]);

  const allMessages: ChatDisplayMessage[] = useMemo(() => {
    const result: ChatDisplayMessage[] = [...serverMessages];
    if (pendingUserMessage) {
      result.push(pendingUserMessage);
    }
    if (showLoadingAssistant) {
      result.push({content: '', role: 'assistant', isLoading: true});
    }
    return result;
  }, [serverMessages, pendingUserMessage, showLoadingAssistant]);

  const hasAnyMessage = serverMessages.length > 0;
  const placeholderText =
    !isInputFocused && hasAnyMessage
      ? 'Press Tab ⇥ to focus'
      : 'Questions? Instructions?';

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView();
  };

  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [allMessages, isAtBottom]);

  const handleScroll = () => {
    const el = scrollAreaRef.current;
    if (!el) {
      return;
    }
    const threshold = 120; // px
    const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold;
    setIsAtBottom(atBottom);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = comment.trim();
    if (!trimmed) {
      return;
    }
    if (!autofixData) {
      return;
    }
    // Optimistic user message and loading assistant
    setPendingUserMessage({content: trimmed, role: 'user'});
    setShowLoadingAssistant(true);
    submitChat({
      message: trimmed,
      runId: autofixData.run_id,
      quotedText: selectedPreview?.text,
    });
    setComment('');
    setSelectedPreview(null);
  };

  // Tab focuses input
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') {
        return;
      }
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      const isEditable = target?.isContentEditable;
      if (tag === 'input' || tag === 'textarea' || isEditable) {
        return;
      }
      e.preventDefault();
      textareaRef.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Listen for selection events from AutofixHighlightWrapper
  useEffect(() => {
    type SelectionDetail = {
      groupId: string;
      selectedText: string;
      displayName?: string;
    };

    const handler = (e: Event) => {
      const ce = e as CustomEvent<SelectionDetail>;
      const detail = ce.detail;
      if (!detail || detail.groupId !== groupId) {
        return;
      }
      setSelectedPreview({text: detail.selectedText, displayName: detail.displayName});
    };

    window.addEventListener('autofix:selected', handler as EventListener);
    return () => window.removeEventListener('autofix:selected', handler as EventListener);
  }, [groupId]);

  if (!autofixData) {
    return <LeftPanelContainer />;
  }

  return (
    <LeftPanelContainer>
      <LeftPanelScrollArea ref={scrollAreaRef} onScroll={handleScroll}>
        <Fragment>
          {allMessages.length === 0 ? (
            <PlaceholderText>{t('No messages yet.')}</PlaceholderText>
          ) : (
            <MessagesContainer>
              {allMessages.map((message, i) => (
                <Message key={message.content.slice(0, 10) + i}>
                  <MessageContent isUser={message.role === 'user'}>
                    {message.isLoading ? (
                      <LoadingWrapper>
                        <LoadingIndicator mini size={14} />
                      </LoadingWrapper>
                    ) : message.role === 'user' ? (
                      <UserText>{stripQuotedUserPrefix(message.content)}</UserText>
                    ) : (
                      <MarkedText text={message.content} />
                    )}
                  </MessageContent>
                </Message>
              ))}
              <div ref={messagesEndRef} />
            </MessagesContainer>
          )}
        </Fragment>
      </LeftPanelScrollArea>
      <BottomBar>
        {selectedPreview && (
          <PreviewContainer>
            <PreviewQuote title={selectedPreview.text}>
              {selectedPreview.text}
            </PreviewQuote>
            <ClearPreviewButton
              size="zero"
              borderless
              aria-label={t('Clear selection')}
              onClick={() => setSelectedPreview(null)}
            >
              <IconClose size="xs" />
            </ClearPreviewButton>
          </PreviewContainer>
        )}
        <InputWrapper onSubmit={handleSubmit}>
          <StyledTextArea
            ref={textareaRef}
            value={comment}
            onChange={e => setComment(e.target.value)}
            onFocus={() => setIsInputFocused(true)}
            onBlur={() => setIsInputFocused(false)}
            autosize
            placeholder={placeholderText}
            size="sm"
            maxRows={4}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e as unknown as React.FormEvent);
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
      </BottomBar>
    </LeftPanelContainer>
  );
}

const LeftPanelContainer = styled('div')`
  position: relative;
  height: 100%;
  min-height: 0;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  background: ${p => p.theme.backgroundSecondary};
  border-right: 1px solid ${p => p.theme.border};
`;

const LeftPanelScrollArea = styled('div')`
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  padding: ${space(2)};
  /* Ensure content can scroll under the pinned BottomBar */
  padding-bottom: 100px;
`;

const PlaceholderText = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
`;

const MessagesContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.75)};
  margin-top: ${space(1)};
  padding-bottom: ${p => p.theme.space['3xl']};
`;

const Message = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: flex-start;
`;

const MessageContent = styled('div')<{isUser: boolean}>`
  flex-grow: 1;
  padding-top: ${p => p.theme.space.xs};
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  font-style: ${p => (p.isUser ? 'italic' : 'normal')};
  overflow-x: hidden;

  border-bottom: ${p => (p.isUser ? `1px solid ${p.theme.border}` : 'none')};

  code {
    font-size: ${p => p.theme.fontSize.xs};
    color: ${p => p.theme.subText};
    background: transparent;
  }

  /* Ensure fenced code blocks wrap instead of causing horizontal scroll */
  pre {
    white-space: pre-wrap;
    word-break: break-word;
    overflow-wrap: anywhere;
    max-width: 100%;
  }

  pre code {
    white-space: inherit;
  }
`;

const UserText = styled('div')`
  padding-bottom: ${p => p.theme.space.md};
`;

const LoadingWrapper = styled('div')`
  display: flex;
  align-items: center;
  height: 24px;
  margin-top: ${space(0.25)};
`;

const BottomBar = styled('div')`
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 1;
  padding: ${p => p.theme.space.md};
  background: ${p => p.theme.backgroundSecondary};
`;

const StyledTextArea = styled(TextArea)`
  resize: none;
  width: 100%;
  border-color: ${p => p.theme.innerBorder};
  padding-right: ${space(4)};
  &:hover {
    border-color: ${p => p.theme.border};
  }
`;

const InputWrapper = styled('form')`
  position: relative;
`;

const StyledButton = styled(Button)`
  position: absolute;
  right: ${space(1)};
  top: 50%;
  transform: translateY(-50%);
  height: 24px;
  width: 24px;
  margin-right: 0;
  color: ${p => p.theme.subText};
  z-index: 2;
`;

const PreviewContainer = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  background: ${p => p.theme.backgroundSecondary};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(0.5)} ${space(0.5)};
  margin-bottom: ${space(1)};
`;

const ClearPreviewButton = styled(Button)`
  color: ${p => p.theme.subText};
  flex-shrink: 0;
`;

const PreviewQuote = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  padding-left: ${p => p.theme.space.md};
  border-left: 2px solid ${p => p.theme.focusBorder};
  color: ${p => p.theme.subText};
`;
