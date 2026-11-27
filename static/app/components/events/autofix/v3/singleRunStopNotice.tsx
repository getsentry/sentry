import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';

import type {SingleRunStop} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t} from 'sentry/locale';

const sentenceSegmenter = new Intl.Segmenter(undefined, {granularity: 'sentence'});

function getFirstSentence(text: string): string {
  const first = sentenceSegmenter.segment(text)[Symbol.iterator]().next().value;
  return first?.segment.trim() || text;
}

interface SingleRunStopNoticeProps {
  stop: SingleRunStop;
}

export function SingleRunStopNotice({stop}: SingleRunStopNoticeProps) {
  const reason = stop.reason.trim();
  const headline = getFirstSentence(reason);

  return (
    <Alert
      variant="warning"
      data-test-id="autofix-single-run-stop"
      expand={headline === reason ? undefined : <Markdown raw={reason} />}
    >
      <Stack gap="sm">
        <Markdown raw={`**${t('Seer stopped early:')}** ${headline}`} />
        <Markdown raw={`**${t('Next step:')}** ${stop.suggestion.trim()}`} />
      </Stack>
    </Alert>
  );
}
