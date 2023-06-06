import {Event} from 'sentry/types';

export function getReplayIdFromEvent(event: Event | null | undefined) {
  const replayTagId = event?.tags?.find(({key}) => key === 'replayId')?.value;
  const replayContextId = event?.contexts?.replay?.replay_id;

  return replayContextId ?? replayTagId;
}
