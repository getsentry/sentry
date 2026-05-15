import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';

import {IconCopy, IconThumb} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import {getConversationsUrlForExternalUse} from 'sentry/views/explore/conversations/utils/urlParams';
import type {Block} from 'sentry/views/seerExplorer/types';
import {getExplorerUrl, getLangfuseUrl} from 'sentry/views/seerExplorer/utils';

import {
  BlockWrapper,
  SeerMarkdown,
  MessagePlaceholder,
  hasValidContent,
  useBlockContext,
} from './shared';

export function AssistantBlock() {
  const {block} = useBlockContext();
  const content = block.message.content ?? '';

  if (block.loading) {
    return <MessagePlaceholder content={content} />;
  }

  return (
    <Fragment>
      {hasValidContent(content) && (
        <Container padding="xl" minWidth={0} overflow="hidden">
          <SeerMarkdown raw={content} variant="streaming" />
        </Container>
      )}
      <BlockActionBar />
    </Fragment>
  );
}

// ─── Action Bar ─────────────────────────────────────────────

function useBlockFeedback(block: Block, blockIndex: number, runId: number | undefined) {
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

function BlockActionBar() {
  const {block, blockIndex, runId, interactionPending} = useBlockContext();
  const {feedbackSubmitted, trackFeedback} = useBlockFeedback(block, blockIndex, runId);
  const {copy} = useCopyToClipboard();
  const showCopy = !!block.message.content?.trim();

  if (interactionPending) {
    return null;
  }

  return (
    <ActionBarWrapper gap="xs">
      <FeedbackButton
        type="positive"
        disabled={feedbackSubmitted}
        onClick={trackFeedback}
      />
      <FeedbackButton
        type="negative"
        disabled={feedbackSubmitted}
        onClick={trackFeedback}
      />
      {showCopy && (
        <Button
          aria-label={t('Copy block content')}
          icon={<IconCopy />}
          variant="transparent"
          size="xs"
          tooltipProps={{title: t('Copy to clipboard')}}
          onClick={e => {
            e.stopPropagation();
            copy(block.message.content ?? '');
          }}
        >
          {undefined}
        </Button>
      )}
    </ActionBarWrapper>
  );
}

function FeedbackButton({
  type,
  disabled,
  onClick,
}: {
  disabled: boolean;
  onClick: (type: 'positive' | 'negative') => void;
  type: 'positive' | 'negative';
}) {
  const ariaLabel =
    type === 'positive' ? t('Feedback Thumbs Up') : t('Feedback Thumbs Down');
  return (
    <Button
      aria-label={ariaLabel}
      icon={<IconThumb direction={type === 'positive' ? 'up' : 'down'} />}
      disabled={disabled}
      variant="transparent"
      size="xs"
      tooltipProps={{
        title: disabled
          ? t('Feedback submitted')
          : type === 'positive'
            ? t('I like this response')
            : t("I don't like this response"),
      }}
      onClick={e => {
        e.stopPropagation();
        onClick(type);
      }}
    >
      {undefined}
    </Button>
  );
}

// ─── Styled Components ──────────────────────────────────────

const ActionBarWrapper = styled(Flex)`
  position: absolute;
  bottom: ${p => p.theme.space['2xs']};
  right: ${p => p.theme.space.md};
  white-space: nowrap;
  font-size: ${p => p.theme.font.size.sm};
  background: ${p => p.theme.tokens.background.primary};
  visibility: hidden;

  ${BlockWrapper}:hover &,
  ${BlockWrapper}:focus-within & {
    visibility: visible;
  }
`;
