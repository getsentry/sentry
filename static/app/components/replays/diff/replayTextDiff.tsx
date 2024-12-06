import {useMemo} from 'react';
import styled from '@emotion/styled';
import beautify from 'js-beautify';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import DiffFeedbackBanner from 'sentry/components/replays/diff/diffFeedbackBanner';
import {After, Before, DiffHeader} from 'sentry/components/replays/diff/utils';
import SplitDiff from 'sentry/components/splitDiff';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useExtractPageHtml from 'sentry/utils/replays/hooks/useExtractPageHtml';
import type ReplayReader from 'sentry/utils/replays/replayReader';

interface Props {
  leftOffsetMs: number;
  replay: ReplayReader;
  rightOffsetMs: number;
}

export function ReplayTextDiff({replay, leftOffsetMs, rightOffsetMs}: Props) {
  const {data, isLoading} = useExtractPageHtml({
    replay,
    offsetMsToStopAt: [leftOffsetMs, rightOffsetMs],
  });

  const [leftBody, rightBody] = useMemo(
    () => data?.map(([_, html]) => beautify.html(html, {indent_size: 2})) ?? [],
    [data]
  );

  return (
    <Container>
      {!isLoading && leftBody === rightBody ? <DiffFeedbackBanner /> : null}
      <DiffHeader>
        <Before>
          <CopyToClipboardButton
            text={leftBody ?? ''}
            size="xs"
            iconSize="xs"
            borderless
            aria-label={t('Copy Before')}
          />
        </Before>
        <After>
          <CopyToClipboardButton
            text={rightBody ?? ''}
            size="xs"
            iconSize="xs"
            borderless
            aria-label={t('Copy After')}
          />
        </After>
      </DiffHeader>
      <SplitDiffScrollWrapper>
        <SplitDiff base={leftBody ?? ''} target={rightBody ?? ''} type="words" />
      </SplitDiffScrollWrapper>
    </Container>
  );
}

const Container = styled('div')`
  height: 0;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
`;

const SplitDiffScrollWrapper = styled('div')`
  overflow: auto;
  height: 0;
  display: flex;
  flex-grow: 1;
`;
