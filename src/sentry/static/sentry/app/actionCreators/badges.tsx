import {observable} from 'mobx';

import {uniqueId} from 'app/utils/guid';
import {Badge} from 'app/types';

const BADGE_SHOWN_TIME = 8000;

type TriggeredAlert = {
  id: string;
  badge: Badge;
};

export const activeAlerts = observable.array<TriggeredAlert>();

// Removes a single indicator
export function triggerBadgeAlert(badge: Badge) {
  const id = uniqueId();
  const item = {id, badge};

  activeAlerts.push(item);
  setTimeout(
    () => activeAlerts.remove(activeAlerts.find(a => a.id === id)!),
    BADGE_SHOWN_TIME
  );
}
