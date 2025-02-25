import {useState} from 'react';

import {
  GroupPriorityBadge,
  GroupPriorityDropdown,
} from 'sentry/components/badge/groupPriority';
import StoryBook from 'sentry/stories/storyBook';
import {PriorityLevel} from 'sentry/types/group';

const PRIORITIES = [PriorityLevel.HIGH, PriorityLevel.MEDIUM, PriorityLevel.LOW];

export const Badge = StoryBook('GroupPriorityBadge', Story => {
  Story('Default', () => (
    <Story.SideBySide>
      {PRIORITIES.map(priority => (
        <GroupPriorityBadge key={priority} priority={priority} />
      ))}
    </Story.SideBySide>
  ));
});

export const Dropdown = StoryBook('GroupPriorityDropdown', Story => {
  Story('Default', () => {
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
