import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {isHydrationError} from 'sentry/utils/react/isHydrationError';
import {getReplayIdFromEvent} from 'sentry/utils/replays/getReplayIdFromEvent';

import {ReplayDiffSection} from './replayDiffSection';

interface Props {
  event: Event;
  group?: Group;
}

export function EventHydrationDiff({event, group}: Props) {
  const replayId = getReplayIdFromEvent(event);

  if (replayId && isHydrationError(event.title)) {
    return <ReplayDiffSection event={event} replayId={replayId} group={group} />;
  }

  return null;
}
