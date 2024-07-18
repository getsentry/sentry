import type ReplayReader from 'sentry/utils/replays/replayReader';

export default function extractDomNodes({replay}: {replay: null | ReplayReader}) {
  return replay?.getExtractDomNodes();
}
