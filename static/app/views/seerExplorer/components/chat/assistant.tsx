import {Fragment} from 'react';
import {css} from '@emotion/react';

import {AssistantActions, AssistantMessage, MessageRow} from '@sentry/scraps/chat';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import {getConversationsUrlForExternalUse} from 'sentry/views/explore/conversations/utils/urlParams';
import type {Block, SeerExplorerRunId} from 'sentry/views/seerExplorer/types';
import {getExplorerUrl, getLangfuseUrl} from 'sentry/views/seerExplorer/utils';

import type {AssistantBlockProps} from './shared';
import {BLOCK_WRAPPER_SELECTOR, MessagePlaceholder, hasValidContent} from './shared';

export function AssistantBlock({
  block,
  blockIndex,
  runId,
  interactionPending,
  readOnly,
}: AssistantBlockProps) {
  const organization = useOrganization();
  const content = block.message.content ?? '';
  const isStreamingEnabled = organization.features.includes('seer-explorer-stream');

  if (block.loading) {
    if (isStreamingEnabled && hasValidContent(content)) {
      return (
        <MessageRow from="assistant">
          <AssistantMessage>
            <SeerMarkdown raw={content} variant="streaming" />
          </AssistantMessage>
        </MessageRow>
      );
    }
    return <MessagePlaceholder content={isStreamingEnabled ? undefined : content} />;
  }

  return (
    <Fragment>
      {hasValidContent(content) && (
        <MessageRow from="assistant">
          <AssistantMessage>
            <SeerMarkdown raw={content} />
          </AssistantMessage>
        </MessageRow>
      )}
      <BlockActionBar
        block={block}
        blockIndex={blockIndex}
        runId={runId}
        interactionPending={interactionPending}
        readOnly={readOnly}
      />
    </Fragment>
  );
}

function useBlockFeedback(
  block: Block,
  blockIndex: number,
  runId: SeerExplorerRunId | undefined
) {
  const organization = useOrganization();
  const [feedbackSubmitted, setFeedbackSubmitted] = useSessionStorage(
    `seer-explorer-feedback:run-${runId ?? 'null'}:block-${block.id}`,
    false
  );

  const trackFeedback = (type: 'positive' | 'negative') => {
    if (!feedbackSubmitted && runId !== undefined) {
      trackAnalytics('seer.explorer.feedback_submitted', {
        organization,
        type,
        run_id: runId,
        block_index: blockIndex,
        block_message: block.message.content?.slice(0, 100) ?? '',
        langfuse_url: getLangfuseUrl(runId),
        explorer_url: getExplorerUrl(runId),
        conversations_url: getConversationsUrlForExternalUse('sentry', runId),
      });
      setFeedbackSubmitted(true);
    }
  };

  return {feedbackSubmitted, trackFeedback};
}

function BlockActionBar({
  block,
  blockIndex,
  runId,
  interactionPending,
  readOnly,
}: AssistantBlockProps) {
  const organization = useOrganization();
  const {feedbackSubmitted, trackFeedback} = useBlockFeedback(block, blockIndex, runId);
  const showCopy = !!block.message.content?.trim();

  if (readOnly || interactionPending) {
    return null;
  }

  return (
    <AssistantActions
      position="absolute"
      bottom="2px"
      right="8px"
      visibility="hidden"
      onFeedback={trackFeedback}
      feedbackDisabled={feedbackSubmitted}
      copyText={showCopy ? (block.message.content ?? '') : undefined}
      onCopy={() => {
        trackAnalytics('seer.explorer.block_copied', {organization});
      }}
      css={css`
        ${BLOCK_WRAPPER_SELECTOR}:hover &,
        ${BLOCK_WRAPPER_SELECTOR}:focus-within & {
          visibility: visible;
        }
      `}
    />
  );
}
