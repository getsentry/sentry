import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import type ReplayReader from 'sentry/utils/replays/replayReader';

interface Props {
  replay: ReplayReader | null;
}

export default function useTouchEventsCheck({replay}: Props) {
  useEffect(() => {
    if (!replay || !replay.getVideoEvents()) {
      return;
    }
    const touchEvents = replay.getRRwebTouchEvents() ?? [];
    const grouped = Object.groupBy(touchEvents, (t: any) => t.data.pointerId);
    Object.values(grouped).forEach(t => {
      if (t?.length !== 2) {
        Sentry.captureMessage(
          'Mobile replay has mismatching touch start and end events',
          {
            tags: {
              sdk_name: replay.getReplay().sdk.name,
              sdk_version: replay.getReplay().sdk.version,
              touch_event_type: typeof t,
            },
          }
        );
      }
    });
  }, [replay]);
}
