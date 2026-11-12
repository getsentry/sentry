import {PriorityLevel} from 'sentry/types/group';

import {GroupPriorityBadge} from './groupPriority';

describe('GroupPriorityBadge', () => {
  it.snapshot.each<PriorityLevel>([
    PriorityLevel.HIGH,
    PriorityLevel.MEDIUM,
    PriorityLevel.LOW,
  ])(
    '%s',
    priority => (
      <div style={{padding: 8}}>
        <GroupPriorityBadge priority={priority} />
      </div>
    ),
    priority => ({tags: {area: 'core', priority: String(priority)}})
  );

  it.snapshot('icon-only', () => (
    <div style={{padding: 8}}>
      <GroupPriorityBadge priority={PriorityLevel.HIGH} showLabel={false} />
    </div>
  ));
});
