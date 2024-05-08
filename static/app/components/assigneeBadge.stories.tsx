import {Fragment} from 'react';

import {AssigneeBadge} from 'sentry/components/assigneeBadge';
import storyBook from 'sentry/stories/storyBook';
import type {Actor} from 'sentry/types';
import {useUser} from 'sentry/utils/useUser';
import {useUserTeams} from 'sentry/utils/useUserTeams';

export default storyBook(AssigneeBadge, story => {
  story('User Assignee Exists (no label)', () => {
    const user = useUser();

    const userActor: Actor = {
      type: 'user',
      id: user.id,
      name: user.name,
      email: user.email,
    };

    return <AssigneeBadge assignedTo={userActor} chevronDirection="down" />;
  });

  story('User Assignee Exists (with label)', () => {
    const user = useUser();

    const userActor: Actor = {
      type: 'user',
      id: user.id,
      name: user.name,
      email: user.email,
    };

    return <AssigneeBadge assignedTo={userActor} showLabel chevronDirection="down" />;
  });

  story('Team Assignee', () => {
    const {teams} = useUserTeams();

    const teamActor: Actor = {
      type: 'team',
      id: teams[0].id,
      name: teams[0].name,
    };

    return (
      <Fragment>
        <p>
          <AssigneeBadge assignedTo={teamActor} chevronDirection="down" />
        </p>
        <p>
          <AssigneeBadge assignedTo={teamActor} showLabel chevronDirection="down" />
        </p>
      </Fragment>
    );
  });

  story('Assignee Does Not Exist (no label)', () => {
    return <AssigneeBadge assignedTo={undefined} chevronDirection="down" />;
  });

  story('Assignee Does Not Exist (with label)', () => {
    return <AssigneeBadge assignedTo={undefined} showLabel chevronDirection="down" />;
  });
});
