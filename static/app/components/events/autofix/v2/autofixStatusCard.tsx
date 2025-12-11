import {Container} from '@sentry/scraps/layout/container';
import {Flex} from '@sentry/scraps/layout/flex';

import {Button} from 'sentry/components/core/button';
import {Text} from 'sentry/components/core/text';
import {IconChat, IconSeer} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Block} from 'sentry/views/seerExplorer/types';
import {getToolsStringFromBlock} from 'sentry/views/seerExplorer/utils';

interface ExplorerStatusCardProps {
  /**
   * Current status of the autofix run.
   */
  status: 'processing' | 'completed' | 'error' | 'awaiting_user_input';
  /**
   * The currently loading block (if any).
   */
  loadingBlock?: Block;
  /**
   * Optional callback to open the chat.
   */
  onOpenChat?: () => void;
}

/**
 * Status card shown when the autofix run is processing.
 *
 * Displays a loading indicator and the latest tool action or message from the agent.
 */
export function ExplorerStatusCard({
  status,
  loadingBlock,
  onOpenChat,
}: ExplorerStatusCardProps) {
  if (status !== 'processing') {
    return null;
  }

  // Get tool strings if the block has tool calls
  const toolStrings = loadingBlock ? getToolsStringFromBlock(loadingBlock) : [];

  // Show tool string if available, otherwise message content, otherwise default
  const displayText =
    toolStrings.length > 0
      ? toolStrings[toolStrings.length - 1]
      : loadingBlock?.message?.content || t('Analyzing...');

  return (
    <Container padding="xl" border="primary" radius="md" background="primary">
      <Flex direction="column" gap="xl">
        <Flex align="center" gap="lg">
          <IconSeer variant="loading" size="lg" />
          <Text size="md" ellipsis>
            {displayText}
          </Text>
        </Flex>
        {onOpenChat && (
          <Flex gap="md">
            <Button size="md" onClick={onOpenChat} priority="primary" icon={<IconChat />}>
              {t('Open Chat')}
            </Button>
          </Flex>
        )}
      </Flex>
    </Container>
  );
}
