import type {Event} from 'sentry/types/event';

export function getReplayIdFromEvent(event: Event | null | undefined) {
  const replayTagId = event?.tags?.find(({key}) => key === 'replayId')?.value;
  const replayContextId = event?.contexts?.replay?.replay_id;

  return replayContextId ?? replayTagId;
}
