import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import {Provider as ReplayContextProvider} from 'sentry/components/replays/replayContext';
import ReplayPlayer from 'sentry/components/replays/replayPlayer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type ReplayReader from 'sentry/utils/replays/replayReader';

interface Props {
  leftOffsetMs: number;
  replay: null | ReplayReader;
  rightOffsetMs: number;
}

export function ReplaySideBySideImageDiff({leftOffsetMs, replay, rightOffsetMs}: Props) {
  const fetching = false;

  return (
    <Flex column>
      <DiffHeader>
        <Before flex="1" align="center">
          {t('Before')}
        </Before>
        <After flex="1" align="center">
          {t('After')}
        </After>
      </DiffHeader>

      <ReplayGrid>
        <ReplayContextProvider
          analyticsContext="replay_comparison_modal_left"
          initialTimeOffsetMs={{offsetMs: leftOffsetMs}}
          isFetching={fetching}
          replay={replay}
        >
          <Border>
            <ReplayPlayer isPreview />
          </Border>
        </ReplayContextProvider>

        <ReplayContextProvider
          analyticsContext="replay_comparison_modal_right"
          initialTimeOffsetMs={{offsetMs: rightOffsetMs}}
          isFetching={fetching}
          replay={replay}
        >
          {rightOffsetMs > 0 ? (
            <Border>
              <ReplayPlayer isPreview />
            </Border>
          ) : (
            <div />
          )}
        </ReplayContextProvider>
      </ReplayGrid>
    </Flex>
  );
}

const DiffHeader = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
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

const ReplayGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
`;

export const Before = styled(Flex)`
  color: ${p => p.theme.red300};
`;

export const After = styled(Flex)`
  color: ${p => p.theme.green300};
`;

const Border = styled('span')`
  border: 3px solid;
  border-radius: ${space(0.5)};
  border-color: ${p => p.theme.red300};
  & + & {
    border-color: ${p => p.theme.green300};
  }
  overflow: hidden;
`;
