import {useMemo} from 'react';
import styled from '@emotion/styled';
import beautify from 'js-beautify';

import Alert from 'sentry/components/alert';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import ExternalLink from 'sentry/components/links/externalLink';
import {After, Before, DiffHeader} from 'sentry/components/replays/diff/utils';
import SplitDiff from 'sentry/components/splitDiff';
import {t, tct} from 'sentry/locale';
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
    <Container>
      <StyledAlert type="info" showIcon>
        {tct(
          `The HTML Diff is currently in beta and has known issues (e.g. the 'Before' is sometimes empty). We are exploring different options to replace this view. Please see [link: this ticket] for more details and share your feedback.`,
          {
            link: (
              <ExternalLink href="https://github.com/getsentry/sentry/issues/80092" />
            ),
          }
        )}
      </StyledAlert>
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

const StyledAlert = styled(Alert)`
  margin: 0;
`;

const SplitDiffScrollWrapper = styled('div')`
  overflow: auto;
  height: 0;
  display: flex;
  flex-grow: 1;
`;
