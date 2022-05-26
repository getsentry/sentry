import type {eventWithTime} from 'rrweb/typings/types';

import type {EventTransaction} from 'sentry/types/event';
import ReplayReader from 'sentry/utils/replays/replayReader';

export default class RRWebEventReader extends ReplayReader {
  static build(event: EventTransaction, rrwebEvents: eventWithTime[] | undefined) {
    if (!event || !rrwebEvents) {
      return null;
    }
    return new RRWebEventReader(event, rrwebEvents);
  }

  protected constructor(
    /**
     * The Event that this rrweb data is associated with.
     */
    event: EventTransaction,
    /**
     * The captured data from rrweb.
     * Saved as N attachments that belong to the root Replay event.
     */
    rrwebEvents: eventWithTime[]
  ) {
    super(event, rrwebEvents, []);
  }

  getEvent = () => {
    return this.event;
  };

  getRRWebEvents = () => {
    return this.rrwebEvents;
  };

  getRawCrumbs = () => {
    return [];
  };

  getRawSpans = () => {
    return [];
  };
}
