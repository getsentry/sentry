import type ReplayReader from 'sentry/utils/replays/replayReader';

interface Props {
  // offsetMsToStopAt: number[];
  replay: ReplayReader | null;
}

export default function extractPageHtml({replay}: Props) {
  return replay?.getExtractPageHtml();
}
