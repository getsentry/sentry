import {memo, useCallback, useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {IconChevron, IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {BlockComponent} from 'sentry/views/seerExplorer/blockComponents';
import type {PendingUserInput} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import type {Block} from 'sentry/views/seerExplorer/types';

const MAX_CHAT_HISTORY_HEIGHT = 500;

export type WidgetError = {
  errorMessage: string;
  widgetTitle: string;
};

interface DashboardChatPanelProps {
  blocks: Block[];
  isUpdating: boolean;
  onSend: (message: string) => void;
  isError?: boolean;
  pendingUserInput?: PendingUserInput | null;
  widgetErrors?: WidgetError[];
}

export function DashboardChatPanel({
  blocks,
  pendingUserInput,
  onSend,
  isUpdating,
  isError,
  widgetErrors,
}: DashboardChatPanelProps) {
  const theme = useTheme();
  const [inputValue, setInputValue] = useState('');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Expand history automatically when updating triggered by user input
  useEffect(() => {
    if (isUpdating) {
      setIsHistoryExpanded(true);
    }
  }, [isUpdating]);

  // Scroll chat to bottom when new blocks arrive or pending input appears
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [blocks.length, pendingUserInput, widgetErrors?.length]);

  const handleSubmit = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed || isUpdating) {
      return;
    }
    onSend(trimmed);
    setInputValue('');

    // Reset textarea height
    if (textAreaRef.current) {
      textAreaRef.current.style.height = 'auto';
    }
  }, [inputValue, isUpdating, onSend]);

  // Handle Enter key press to send message
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);

    // Auto-resize textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, []);

  const hasHistory = blocks.length > 0;

  return (
    <Container
      position="sticky"
      bottom={0}
      border="primary"
      radius="md"
      maxWidth="800px"
      width="100%"
      background="primary"
      margin="0 auto"
      style={{zIndex: theme.zIndex.dropdown, marginBottom: '24px'}}
    >
      <Flex justify="between">
        <ChatHistoryToggle
          onClick={() => setIsHistoryExpanded(prev => !prev)}
          aria-expanded={isHistoryExpanded}
          priority="transparent"
          disabled={!hasHistory}
        >
          <Flex align="center" gap="sm">
            <IconSeer size="sm" />
            {t('Conversation')} ({blocks.length})
            {hasHistory && (
              <IconChevron direction={isHistoryExpanded ? 'down' : 'up'} size="xs" />
            )}
          </Flex>
        </ChatHistoryToggle>
        <Container padding="md xl">
          <FeatureBadge type="beta" />
        </Container>
      </Flex>
      {hasHistory && isHistoryExpanded && (
        <ChatHistory
          ref={chatContainerRef}
          blocks={blocks}
          pendingUserInput={pendingUserInput}
          isError={isError}
          widgetErrors={widgetErrors}
        />
      )}
      <InputGroup>
        <Container padding="md">
          <InputGroup.TextArea
            ref={textAreaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={
              isUpdating
                ? t('Updating dashboard...')
                : t('Ask Seer to modify this dashboard...')
            }
            disabled={isUpdating}
            rows={1}
            style={{resize: 'none', overflow: 'hidden'}}
          />
        </Container>
      </InputGroup>
    </Container>
  );
}

const ChatHistory = memo(function ChatHistoryInner({
  ref,
  blocks,
  pendingUserInput,
  isError,
  widgetErrors,
}: {
  blocks: Block[];
  ref: React.Ref<HTMLDivElement>;
  isError?: boolean;
  pendingUserInput?: PendingUserInput | null;
  widgetErrors?: WidgetError[];
}) {
  return (
    <Container
      ref={ref}
      maxHeight={`${MAX_CHAT_HISTORY_HEIGHT}px`}
      overflowY="auto"
      overflowX="hidden"
      borderTop="primary"
    >
      <Stack>
        {blocks.map((block, index) => (
          <BlockComponent key={block.id} block={block} blockIndex={index} />
        ))}
        {pendingUserInput && pendingUserInput.data.questions?.length > 0 && (
          <ChatMessageContainer padding="xl">
            <MarkedText text={pendingUserInput.data.questions[0].question} inline />
          </ChatMessageContainer>
        )}
        {isError && (
          <ChatMessageContainer padding="xl">
            <Alert.Container>
              <Alert variant="warning" showIcon>
                {t(
                  'An error was encountered while generating the dashboard. Please resubmit your prompt to try again.'
                )}
              </Alert>
            </Alert.Container>
          </ChatMessageContainer>
        )}
        {widgetErrors && widgetErrors.length > 0 && (
          <ChatMessageContainer padding="xl">
            <Alert.Container>
              <Alert variant="warning" showIcon>
                {t('Some widgets encountered errors. You can ask Seer to fix them.')}
                <ul>
                  {widgetErrors.map(({widgetTitle, errorMessage}) => (
                    <li key={`${widgetTitle}:${errorMessage}`}>
                      <strong>{widgetTitle}</strong>: {errorMessage}
                    </li>
                  ))}
                </ul>
              </Alert>
            </Alert.Container>
          </ChatMessageContainer>
        )}
      </Stack>
    </Container>
  );
});

const ChatHistoryToggle = styled(Button)`
  &:hover {
    color: ${p => p.theme.tokens.content.primary};
    background-color: ${p => p.theme.tokens.background.primary};
  }
`;

const ChatMessageContainer = styled(Container)`
  padding: ${p => p.theme.space.xl};
  padding-left: 40px;
`;
