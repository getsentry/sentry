import {memo, useCallback, useEffect, useRef, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {IconChevron, IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useLocation} from 'sentry/utils/useLocation';
import {BlockComponent} from 'sentry/views/seerExplorer/blockComponents';
import type {PendingUserInput} from 'sentry/views/seerExplorer/hooks/useSeerExplorer';
import type {Block} from 'sentry/views/seerExplorer/types';

const MAX_CHAT_HISTORY_HEIGHT = 500;

interface DashboardChatPanelProps {
  blocks: Block[];
  isUpdating: boolean;
  onSend: (message: string) => void;
  pendingUserInput?: PendingUserInput | null;
}

export function DashboardChatPanel({
  blocks,
  pendingUserInput,
  onSend,
  isUpdating,
}: DashboardChatPanelProps) {
  const theme = useTheme();
  const location = useLocation();
  const [inputValue, setInputValue] = useState('');
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(true);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const seerRunId = location.query?.seerRunId
    ? Number(location.query.seerRunId)
    : undefined;

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
  }, [blocks.length, pendingUserInput]);

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
      {hasHistory && (
        <ChatHistoryToggle
          onClick={() => setIsHistoryExpanded(prev => !prev)}
          aria-expanded={isHistoryExpanded}
          priority="transparent"
        >
          <Flex align="center" gap="sm">
            <IconSeer size="sm" />
            {t('Conversation')} ({blocks.length})
            <IconChevron direction={isHistoryExpanded ? 'down' : 'up'} size="xs" />
          </Flex>
        </ChatHistoryToggle>
      )}
      {hasHistory && isHistoryExpanded && (
        <ChatHistory
          ref={chatContainerRef}
          blocks={blocks}
          pendingUserInput={pendingUserInput}
          seerRunId={seerRunId}
        />
      )}
      <InputGroup>
        {!hasHistory && <IconSeer size="md" />}
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
  seerRunId,
}: {
  blocks: Block[];
  ref: React.Ref<HTMLDivElement>;
  pendingUserInput?: PendingUserInput | null;
  seerRunId?: number;
}) {
  return (
    <Container
      ref={ref}
      maxHeight={`${MAX_CHAT_HISTORY_HEIGHT}px`}
      overflowY="auto"
      overflowX="hidden"
      border="primary"
    >
      <Stack>
        {blocks.map((block, index) => (
          <BlockComponent
            key={block.id}
            block={block}
            blockIndex={index}
            runId={seerRunId}
          />
        ))}
        {pendingUserInput && pendingUserInput.data.questions?.length > 0 && (
          <Container padding="xl" style={{paddingLeft: '40px'}}>
            <MarkedText text={pendingUserInput.data.questions[0].question} inline />
          </Container>
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
