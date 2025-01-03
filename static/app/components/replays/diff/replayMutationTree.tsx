import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import DiffFeedbackBanner from 'sentry/components/replays/diff/diffFeedbackBanner';
import {After, Before, DiffHeader} from 'sentry/components/replays/diff/utils';
import StructuredEventData from 'sentry/components/structuredEventData';
import useExtractDiffMutations from 'sentry/utils/replays/hooks/useExtractDiffMutations';
import type ReplayReader from 'sentry/utils/replays/replayReader';

interface Props {
  leftOffsetMs: number;
  replay: ReplayReader;
  rightOffsetMs: number;
}

export function ReplayMutationTree({replay, leftOffsetMs, rightOffsetMs}: Props) {
  const {data, isLoading} = useExtractDiffMutations({
    leftOffsetMs,
    replay,
    rightOffsetMs,
  });

  const timeIndexedMutations = Array.from(data?.values() ?? []).reduce(
    (acc, mutation) => {
      for (const timestamp of Object.keys(mutation)) {
        acc[timestamp] = mutation[timestamp];
      }
      return acc;
    },
    {}
  );

  return (
    <Fragment>
      <DiffHeader>
        <Before startTimestampMs={replay.getStartTimestampMs()} offset={leftOffsetMs} />
        <After startTimestampMs={replay.getStartTimestampMs()} offset={rightOffsetMs} />
      </DiffHeader>
      {!isLoading && Object.keys(timeIndexedMutations).length === 0 ? (
        <DiffFeedbackBanner />
      ) : null}
      <ScrollWrapper>
        <StructuredEventData
          key={data?.size}
          data={timeIndexedMutations}
          maxDefaultDepth={4}
          css={css`
            flex: auto 1 1;
            & > pre {
              margin: 0;
            }
          `}
        />
      </ScrollWrapper>
    </Fragment>
  );
}

const ScrollWrapper = styled('div')`
  overflow: auto;
  height: 0;
  display: flex;
  flex-grow: 1;

  & pre {
    margin: 0;
  }
`;
