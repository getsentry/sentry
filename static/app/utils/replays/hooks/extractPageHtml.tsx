import type ReplayReader from 'sentry/utils/replays/replayReader';

export default async function extractPageHtml({replay}: {replay: null | ReplayReader}) {
  const results = await replay?.getExtractPageHtml();
  return Array.from(results?.entries() ?? []).map(([frame, html]) => {
    return [frame.offsetMs, html];
  });
}
