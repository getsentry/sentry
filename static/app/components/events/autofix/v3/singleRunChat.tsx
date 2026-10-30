import {useMemo} from 'react';
import {IconBot} from '@sentry/icons/bot';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';

import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import type {useExplorerAutofix} from 'sentry/components/events/autofix/useExplorerAutofix';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {isSeerExplorerEnabled} from 'sentry/utils/seer/isSeerExplorerEnabled';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SeerExplorerTranscript} from 'sentry/views/seerExplorer/components/chat/transcript';
import {useSeerExplorerDrawer} from 'sentry/views/seerExplorer/components/drawer/useSeerExplorerDrawer';
import type {Block} from 'sentry/views/seerExplorer/types';
import {usePageReferrer} from 'sentry/views/seerExplorer/utils';

function withoutKickoffPrompt(blocks: Block[]): Block[] {
  const firstReply = blocks.findIndex(block => block.message.role !== 'user');
  return firstReply === -1 ? [] : blocks.slice(firstReply);
}

interface SingleRunChatProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
}

export function SingleRunChat({autofix}: SingleRunChatProps) {
  const organization = useOrganization();
  const {getPageReferrer} = usePageReferrer();
  const {openSeerExplorerDrawer} = useSeerExplorerDrawer();
  const {runState} = autofix;
  const runId = getAutofixRunId(runState);
  const blocks = useMemo(() => withoutKickoffPrompt(runState?.blocks ?? []), [runState]);
  const canOpenInExplorer = isSeerExplorerEnabled(organization) && defined(runId);

  return (
    <Stack gap="lg">
      {blocks.length ? (
        <SeerExplorerTranscript
          blocks={blocks}
          runId={runId}
          readOnly
          showThinking={false}
          getPageReferrer={getPageReferrer}
        />
      ) : (
        runState?.status === 'processing' && <Placeholder height="15rem" />
      )}
      {runState?.status === 'error' && (
        <Alert variant="danger">{t('Autofix ran into an error and stopped.')}</Alert>
      )}
      {runState?.status === 'awaiting_user_input' && (
        <Alert variant="warning">
          {canOpenInExplorer
            ? t('Seer needs your input. Open the run in Seer Explorer to respond.')
            : t('Seer is waiting for input to continue.')}
        </Alert>
      )}
      {canOpenInExplorer && (
        <Flex>
          <Button
            size="sm"
            icon={<IconBot />}
            onClick={() => openSeerExplorerDrawer({runId})}
          >
            {t('Open in Seer Explorer')}
          </Button>
        </Flex>
      )}
    </Stack>
  );
}
