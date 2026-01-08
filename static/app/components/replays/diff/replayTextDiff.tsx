import {useMemo} from 'react';
import beautify from 'js-beautify';

import {Flex, Stack} from '@sentry/scraps/layout';

import {ContentSliderDiff} from 'sentry/components/contentSliderDiff';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {useDiffCompareContext} from 'sentry/components/replays/diff/diffCompareContext';
import DiffFeedbackBanner from 'sentry/components/replays/diff/diffFeedbackBanner';
import {After, Before} from 'sentry/components/replays/diff/utils';
import SplitDiff from 'sentry/components/splitDiff';
import {t} from 'sentry/locale';
import useExtractPageHtml from 'sentry/utils/replays/hooks/useExtractPageHtml';

export function ReplayTextDiff() {
  const {replay, leftOffsetMs, rightOffsetMs} = useDiffCompareContext();

  const {data, isLoading} = useExtractPageHtml({
    replay,
    // Add 1 to each offset so we read the HTML just after the specified time
    // and can therefore see the results of the mutations that happened at the
    // requested times, instead of landing on those times directly.
    offsetMsToStopAt: [leftOffsetMs + 1, rightOffsetMs + 1],
  });

  const [leftBody, rightBody] = useMemo(
    () => data?.map(([_, html]) => beautify.html(html, {indent_size: 2})) ?? [],
    [data]
  );

  return (
    <Stack flexGrow={1} gap="md" height="0">
      {!isLoading && leftBody === rightBody ? <DiffFeedbackBanner /> : null}
      <ContentSliderDiff.Header>
        <Before startTimestampMs={replay.getStartTimestampMs()} offset={leftOffsetMs}>
          <CopyToClipboardButton
            text={leftBody ?? ''}
            size="xs"
            borderless
            aria-label={t('Copy Before')}
          />
        </Before>
        <After startTimestampMs={replay.getStartTimestampMs()} offset={rightOffsetMs}>
          <CopyToClipboardButton
            text={rightBody ?? ''}
            size="xs"
            borderless
            aria-label={t('Copy After')}
          />
        </After>
      </ContentSliderDiff.Header>
      <Flex flexGrow={1} height="0" overflow="auto">
        <SplitDiff base={leftBody ?? ''} target={rightBody ?? ''} type="lines" />
      </Flex>
    </Stack>
  );
}
