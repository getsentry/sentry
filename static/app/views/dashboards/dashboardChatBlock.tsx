import styled from '@emotion/styled';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {BlockComponent} from 'sentry/views/seerExplorer/components/chat';
import type {Block} from 'sentry/views/seerExplorer/types';

import {splitDashboardPrompt} from './createFromSeerUtils';

interface DashboardChatBlockProps {
  block: Block;
  blockIndex: number;
  runId?: number;
}

/**
 * Renders a Seer chat block for the dashboard generation/edit flows. The first
 * user message has the generation instructions prepended to it server-side; we
 * show only the user's query and collapse the instructions behind a disclosure
 * so they don't clutter the conversation. All other blocks render normally.
 */
export function DashboardChatBlock({block, blockIndex, runId}: DashboardChatBlockProps) {
  if (block.message.role === 'user' && typeof block.message.content === 'string') {
    const {instructions, query} = splitDashboardPrompt(block.message.content);
    if (instructions) {
      const queryBlock: Block = {
        ...block,
        message: {...block.message, content: query},
      };
      return (
        <Stack width="100%">
          <BlockComponent block={queryBlock} blockIndex={blockIndex} runId={runId} />
          <Container padding="0 xl xl">
            <Disclosure size="xs">
              <Disclosure.Title>{t('System instructions')}</Disclosure.Title>
              <Disclosure.Content>
                <InstructionsContainer maxHeight="240px" overflowY="auto">
                  <Text as="div" variant="muted" size="sm">
                    {instructions}
                  </Text>
                </InstructionsContainer>
              </Disclosure.Content>
            </Disclosure>
          </Container>
        </Stack>
      );
    }
  }

  return <BlockComponent block={block} blockIndex={blockIndex} runId={runId} />;
}

const InstructionsContainer = styled(Container)`
  white-space: pre-wrap;
  word-wrap: break-word;
  overflow-wrap: anywhere;
`;
