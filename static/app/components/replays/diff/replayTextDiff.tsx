import {Flex, Stack} from '@sentry/scraps/layout';

import {ContentSliderDiff} from 'sentry/components/contentSliderDiff';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {useDiffCompareContext} from 'sentry/components/replays/diff/diffCompareContext';
import {DiffFeedbackBanner} from 'sentry/components/replays/diff/diffFeedbackBanner';
import {After, Before} from 'sentry/components/replays/diff/utils';
import SplitDiff from 'sentry/components/splitDiff';
import {t} from 'sentry/locale';
import {useExtractPageHtml} from 'sentry/utils/replays/hooks/useExtractPageHtml';
import {useFormattedCode} from 'sentry/utils/useFormattedCode';

const HTML_FORMAT_OPTIONS = {indent_size: 2} as const;

export function ReplayTextDiff() {
  const {replay, leftOffsetMs, rightOffsetMs} = useDiffCompareContext();

  const {data, isLoading} = useExtractPageHtml({
    replay,
    // Add 1 to each offset so we read the HTML just after the specified time
    // and can therefore see the results of the mutations that happened at the
    // requested times, instead of landing on those times directly.
    offsetMsToStopAt: [leftOffsetMs + 1, rightOffsetMs + 1],
  });

  const [leftBodySource = '', rightBodySource = ''] =
    data?.map(([_, html]) => html) ?? [];
  const {formattedCode: leftBody, isPending: isLeftBodyPending} = useFormattedCode({
    code: leftBodySource,
    language: 'html',
    options: HTML_FORMAT_OPTIONS,
  });
  const {formattedCode: rightBody, isPending: isRightBodyPending} = useFormattedCode({
    code: rightBodySource,
    language: 'html',
    options: HTML_FORMAT_OPTIONS,
  });
  const isFormatting = isLeftBodyPending || isRightBodyPending;

  return (
    <Stack flexGrow={1} gap="md" height="0">
      {!isLoading && !isFormatting && leftBody === rightBody ? (
        <DiffFeedbackBanner />
      ) : null}
      <ContentSliderDiff.Header>
        <Before startTimestampMs={replay.getStartTimestampMs()} offset={leftOffsetMs}>
          <CopyToClipboardButton
            text={leftBody}
            size="xs"
            variant="transparent"
            aria-label={t('Copy Before')}
          />
        </Before>
        <After startTimestampMs={replay.getStartTimestampMs()} offset={rightOffsetMs}>
          <CopyToClipboardButton
            text={rightBody}
            size="xs"
            variant="transparent"
            aria-label={t('Copy After')}
          />
        </After>
      </ContentSliderDiff.Header>
      <Flex flexGrow={1} height="0" overflow="auto">
        <SplitDiff base={leftBody} target={rightBody} />
      </Flex>
    </Stack>
  );
}
