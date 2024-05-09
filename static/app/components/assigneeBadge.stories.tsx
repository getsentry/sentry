import {Fragment, useState} from 'react';

import {AssigneeBadge} from 'sentry/components/assigneeBadge';
import storyBook from 'sentry/stories/storyBook';
import type {Actor} from 'sentry/types';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';

export default storyBook(AssigneeBadge, story => {
  story('User Assignee Exists (no label)', () => {
    const user = useUser();
    const [chevronToggle, setChevronToggle] = useState<'up' | 'down'>('down');
    const userActor: Actor = {
      type: 'user',
      id: user.id,
      name: user.name,
      email: user.email,
    };

    return (
      <div onClick={() => setChevronToggle(chevronToggle === 'up' ? 'down' : 'up')}>
        <AssigneeBadge assignedTo={userActor} chevronDirection={chevronToggle} />
      </div>
    );
  });

  story('User Assignee Exists (with label)', () => {
    const user = useUser();
    const [chevronToggle, setChevronToggle] = useState<'up' | 'down'>('down');

    const userActor: Actor = {
      type: 'user',
      id: user.id,
      name: user.name,
      email: user.email,
    };

    return (
      <div onClick={() => setChevronToggle(chevronToggle === 'up' ? 'down' : 'up')}>
        {' '}
        <AssigneeBadge
          assignedTo={userActor}
          showLabel
          chevronDirection={chevronToggle}
        />
      </div>
    );
  });

  story('Team Assignee', () => {
    const {teams} = useUserTeams();
    const [chevron1Toggle, setChevron1Toggle] = useState<'up' | 'down'>('down');
    const [chevron2Toggle, setChevron2Toggle] = useState<'up' | 'down'>('down');

    const teamActor: Actor = {
      type: 'team',
      id: teams[0].id,
      name: teams[0].name,
    };

    return (
      <Fragment>
        <p onClick={() => setChevron1Toggle(chevron1Toggle === 'up' ? 'down' : 'up')}>
          <AssigneeBadge assignedTo={teamActor} chevronDirection={chevron1Toggle} />
        </p>
        <p onClick={() => setChevron2Toggle(chevron2Toggle === 'up' ? 'down' : 'up')}>
          <AssigneeBadge
            assignedTo={teamActor}
            showLabel
            chevronDirection={chevron2Toggle}
          />
        </p>
      </Fragment>
    );
  });

  story('Assignee Does Not Exist (no label)', () => {
    const [chevronToggle, setChevronToggle] = useState<'up' | 'down'>('down');

    return (
      <div onClick={() => setChevronToggle(chevronToggle === 'up' ? 'down' : 'up')}>
        <AssigneeBadge assignedTo={undefined} chevronDirection={chevronToggle} />
      </div>
    );
  });

  story('Assignee Does Not Exist (with label)', () => {
    const [chevronToggle, setChevronToggle] = useState<'up' | 'down'>('down');
    return (
      <div onClick={() => setChevronToggle(chevronToggle === 'up' ? 'down' : 'up')}>
        <AssigneeBadge
          assignedTo={undefined}
          showLabel
          chevronDirection={chevronToggle}
        />
      </div>
    );
  });
});
