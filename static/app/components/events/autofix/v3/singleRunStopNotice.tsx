import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import type {SingleRunStop} from 'sentry/components/events/autofix/useExplorerAutofix';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {t} from 'sentry/locale';

const sentenceSegmenter = new Intl.Segmenter(undefined, {granularity: 'sentence'});

function getFirstSentence(text: string): string {
  const first = sentenceSegmenter.segment(text)[Symbol.iterator]().next().value;
  return first?.segment.trim() || text;
}

interface SingleRunStopNoticeProps {
  stop: SingleRunStop;
}

/**
 * Why a single run stopped before changing code, and what the reader should do
 * instead. A card of its own rather than part of the root cause, so the reason
 * and the next step stay in view while the root cause is collapsed, and so the
 * Seer Agent chat can show the same card.
 */
export function SingleRunStopNotice({stop}: SingleRunStopNoticeProps) {
  const reason = stop.reason.trim();
  const headline = getFirstSentence(reason);

  return (
    <Alert
      variant="warning"
      data-test-id="autofix-single-run-stop"
      // A one-sentence reason is already on screen in full.
      expand={headline === reason ? undefined : <SeerMarkdown raw={reason} />}
    >
      {/* The labels go into the markdown so they share a line with it. */}
      <Stack gap="sm">
        <SeerMarkdown raw={`**${t('Seer stopped early:')}** ${headline}`} />
        <SeerMarkdown raw={`**${t('Next step:')}** ${stop.suggestion.trim()}`} />
      </Stack>
    </Alert>
  );
}
