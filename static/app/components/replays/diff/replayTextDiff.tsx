import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import beautify from 'js-beautify';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import {After, Before} from 'sentry/components/replays/diff/replaySideBySideImageDiff';
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
  const {data} = useExtractPageHtml({
    replay,
    offsetMsToStopAt: [leftOffsetMs, rightOffsetMs],
  });

  const [leftBody, rightBody] = useMemo(
    () => data?.map(([_, html]) => beautify.html(html, {indent_size: 2})) ?? [],
    [data]
  );

  return (
    <Fragment>
      <DiffHeader>
        <Before flex="1" align="center">
          {t('Before')}
          <CopyToClipboardButton
            text={leftBody ?? ''}
            size="xs"
            iconSize="xs"
            borderless
            aria-label={t('Copy Before')}
          />
        </Before>
        <After flex="1" align="center">
          {t('After')}
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
    </Fragment>
  );
}

const SplitDiffScrollWrapper = styled('div')`
  overflow: auto;
  height: 0;
  display: flex;
  flex-grow: 1;
`;

const DiffHeader = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1.2;

  div {
    height: 28px; /* div with and without buttons inside are the same height */
  }

  div:last-child {
    padding-left: ${space(2)};
  }

  padding: 10px 0;
`;
