import {Fragment, useState} from 'react';

import {AssigneeBadge} from 'sentry/components/assigneeBadge';
import storyBook from 'sentry/stories/storyBook';
import type {Actor} from 'sentry/types';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';

export default storyBook(AssigneeBadge, story => {
  story('User Assignee', () => {
    const user = useUser();
    const [chevron1Toggle, setChevron1Toggle] = useState<'up' | 'down'>('down');
    const [chevron2Toggle, setChevron2Toggle] = useState<'up' | 'down'>('down');
    const userActor: Actor = {
      type: 'user',
      id: user.id,
      name: user.name,
      email: user.email,
    };

    return (
      <Fragment>
        <p onClick={() => setChevron1Toggle(chevron1Toggle === 'up' ? 'down' : 'up')}>
          <AssigneeBadge assignedTo={userActor} chevronDirection={chevron1Toggle} />
        </p>
        <p onClick={() => setChevron2Toggle(chevron2Toggle === 'up' ? 'down' : 'up')}>
          <AssigneeBadge
            showLabel
            assignedTo={userActor}
            chevronDirection={chevron2Toggle}
          />
        </p>
      </Fragment>
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

  story('Unassigned', () => {
    const [chevron1Toggle, setChevron1Toggle] = useState<'up' | 'down'>('down');
    const [chevron2Toggle, setChevron2Toggle] = useState<'up' | 'down'>('down');

    return (
      <Fragment>
        <p onClick={() => setChevron1Toggle(chevron1Toggle === 'up' ? 'down' : 'up')}>
          <AssigneeBadge assignedTo={undefined} chevronDirection={chevron1Toggle} />
        </p>
        <p onClick={() => setChevron2Toggle(chevron2Toggle === 'up' ? 'down' : 'up')}>
          <AssigneeBadge
            showLabel
            assignedTo={undefined}
            chevronDirection={chevron2Toggle}
          />
        </p>
      </Fragment>
    );
  });

  story('Loading', () => {
    return (
      <Fragment>
        <p>
          <AssigneeBadge loading />
        </p>
        <p>
          <AssigneeBadge showLabel loading />
        </p>
      </Fragment>
    );
  });
});
