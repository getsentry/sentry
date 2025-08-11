import {useState} from 'react';

import {
  GroupPriorityBadge,
  GroupPriorityDropdown,
} from 'sentry/components/badge/groupPriority';
import * as Storybook from 'sentry/stories';
import {PriorityLevel} from 'sentry/types/group';

const PRIORITIES = [PriorityLevel.HIGH, PriorityLevel.MEDIUM, PriorityLevel.LOW];

export const Badge = Storybook.story('GroupPriorityBadge', story => {
  story('Default', () => (
    <Storybook.SideBySide>
      {PRIORITIES.map(priority => (
        <GroupPriorityBadge key={priority} priority={priority} />
      ))}
    </Storybook.SideBySide>
  ));
});

export const Dropdown = Storybook.story('GroupPriorityDropdown', story => {
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
