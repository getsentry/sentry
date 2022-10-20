import ScoreBar from 'sentry/components/scoreBar';
import CHART_PALETTE from 'sentry/constants/chartPalette';
import type {ReplayListRecord} from 'sentry/views/replays/types';

interface Props {
  replay: undefined | Pick<ReplayListRecord, 'countErrors' | 'duration' | 'urls'>;
}

const palette = new Array(10).fill([CHART_PALETTE[0][0]]);

function ReplayHighlight({replay}: Props) {
  let score = 1;

  if (replay) {
    const {countErrors, duration, urls} = replay;
    const durationSec = duration.asSeconds();
    const pagesVisited = urls.length;

    const pagesVisitedOverTime = pagesVisited / (durationSec || 1);

    score = (countErrors * 25 + pagesVisited * 5 + pagesVisitedOverTime) / 10;
    // negatively score sub 5 second replays
    if (durationSec <= 5) {
      score = score - 10 / (durationSec || 1);
    }

    score = Math.floor(Math.min(10, Math.max(1, score)));
  }

  return <ScoreBar size={20} score={score} palette={palette} radius={0} />;
}

export default ReplayHighlight;
