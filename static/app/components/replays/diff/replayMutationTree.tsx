import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {useDiffCompareContext} from 'sentry/components/replays/diff/diffCompareContext';
import DiffFeedbackBanner from 'sentry/components/replays/diff/diffFeedbackBanner';
import StructuredEventData from 'sentry/components/structuredEventData';
import useExtractDiffMutations from 'sentry/utils/replays/hooks/useExtractDiffMutations';

export function ReplayMutationTree() {
  const {replay, leftOffsetMs, rightOffsetMs} = useDiffCompareContext();

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
