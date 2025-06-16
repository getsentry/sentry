import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import type ReplayReader from 'sentry/utils/replays/replayReader';

interface Props {
  replay: ReplayReader | null;
}

export default function useTouchEventsCheck({replay}: Props) {
  useEffect(() => {
    if (!replay?.getVideoEvents().length) {
      return;
    }
    const touchEvents = replay.getRRwebTouchEvents() ?? [];
    const grouped = Object.groupBy(touchEvents, (t: any) => t.data.pointerId);
    Object.values(grouped).forEach(t => {
      if (t?.length !== 2) {
        const replayData = replay.getReplay();
        Sentry.logger.debug('Mobile replay: mismatching touch start and end events', {
          sdk_name: replayData.sdk.name,
          sdk_version: replayData.sdk.version,
          pointer_id: t?.[0]?.data.pointerId,
          number_of_events: t?.length,
          replay_id: replayData.id,
          url: window.location.href,
        });
      }
    });
  }, [replay]);
}
