import {useMemo} from 'react';
import {IconBot} from '@sentry/icons/bot';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';

import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import {
  getOrderedAutofixSections,
  isPullRequestsSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {PullRequestsCard} from 'sentry/components/events/autofix/v3/pullRequestsCard';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils/defined';
import {isSeerExplorerEnabled} from 'sentry/utils/seer/isSeerExplorerEnabled';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSeerExplorerDrawer} from 'sentry/views/seerExplorer/components/drawer/useSeerExplorerDrawer';
import {SeerExplorerTranscript} from 'sentry/views/seerExplorer/components/seerExplorerContent';
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
  const pullRequestSections = useMemo(
    () => getOrderedAutofixSections(runState).filter(isPullRequestsSection),
    [runState]
  );

  return (
    <Stack gap="lg">
      <Stack gap="md">
        <SeerExplorerTranscript
          blocks={blocks}
          runId={runId ?? null}
          readOnly
          showThinking={false}
          interactionPending={false}
          pendingInput={null}
          getPageReferrer={getPageReferrer}
        />
      </Stack>
      {pullRequestSections.map(section => (
        <PullRequestsCard
          key={`${section.step}-${section.blocks[0]?.id ?? null}`}
          autofix={autofix}
          section={section}
        />
      ))}
      {isSeerExplorerEnabled(organization) && defined(runId) && (
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
