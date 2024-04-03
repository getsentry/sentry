import {useState} from 'react';

import {
  GroupPriorityBadge,
  GroupPriorityDropdown,
} from 'sentry/components/group/groupPriority';
import SideBySide from 'sentry/components/stories/sideBySide';
import storyBook from 'sentry/stories/storyBook';
import {PriorityLevel} from 'sentry/types';

const PRIORITIES = [PriorityLevel.HIGH, PriorityLevel.MEDIUM, PriorityLevel.LOW];

export const Badge = storyBook(GroupPriorityBadge, story => {
  story('Default', () => (
    <SideBySide>
      {PRIORITIES.map(priority => (
        <GroupPriorityBadge key={priority} priority={priority} />
      ))}
    </SideBySide>
  ));
});

export const Dropdown = storyBook(GroupPriorityDropdown, story => {
  story('Default', () => {
    const [value, setValue] = useState(PriorityLevel.MEDIUM);

    return (
      <GroupPriorityDropdown
        value={value}
        onChange={setValue}
        groupId="1"
        lastEditedBy="system"
      />
    );
  });
});
