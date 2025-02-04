import {Fragment, useState} from 'react';
import {uuid4} from '@sentry/core';

import {AssigneeBadge} from 'sentry/components/assigneeBadge';
import storyBook from 'sentry/stories/storyBook';
import type {Actor} from 'sentry/types/core';
import type {Team} from 'sentry/types/organization';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';

export default storyBook('AssigneeBadge', story => {
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

    const team: Team = teams.length
      ? teams[0]!
      : {
          id: '1',
          slug: 'team-slug',
          name: 'Team Name',
          access: ['team:read'],
          teamRole: null,
          isMember: true,
          memberCount: 0,
          avatar: {avatarType: 'letter_avatar', avatarUuid: uuid4()},
          flags: {
            'idp:provisioned': false,
          },
          externalTeams: [],
          hasAccess: false,
          isPending: false,
        };

    const teamActor: Actor = {
      type: 'team',
      id: team.id,
      name: team.name,
    };

    return (
      <Fragment>
        <p onClick={() => setChevron1Toggle(chevron1Toggle === 'up' ? 'down' : 'up')}>
          <AssigneeBadge
            assignmentReason="suspectCommit"
            assignedTo={teamActor}
            chevronDirection={chevron1Toggle}
          />
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
