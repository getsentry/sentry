export function getReplayTraceSearchQuery(replayId: string) {
  return `(replay.id:${replayId} OR replayId:${replayId})`;
}
