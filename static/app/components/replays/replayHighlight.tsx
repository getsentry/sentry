import React from 'react';

import CHART_PALETTE from 'sentry/constants/chartPalette';
import {ReplayDurationAndErrors} from 'sentry/views/replays/types';

import ScoreBar from '../scoreBar';

interface Props {
  data: ReplayDurationAndErrors | undefined;
}

function replayHighlight({data}: Props) {
  let score = 1;

  if (data) {
    // Mocked data 👇 - this will change with the new backend
    const pagesVisited = 1;
    const {count_if_event_type_equals_error: errors, 'equation[0]': durationInSeconds} =
      data;

    const pagesVisitedOverTime = pagesVisited / (durationInSeconds || 1);

    score = (errors * 25 + pagesVisited * 5 + pagesVisitedOverTime) / 10;
    score = Math.floor(Math.min(10, Math.max(1, score)));
  }

  const palette = new Array(10).fill([CHART_PALETTE[0][0]]);
  return <ScoreBar size={20} score={score} palette={palette} radius={0} />;
}

export default replayHighlight;
