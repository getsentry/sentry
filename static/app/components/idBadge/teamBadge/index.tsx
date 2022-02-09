import * as React from 'react';

import TeamStore from 'sentry/stores/teamStore';
import {Team} from 'sentry/types';

import Badge, {BadgeProps} from './badge';

function TeamBadge(props: BadgeProps) {
  const [team, setTeam] = React.useState<Team>(props.team);

  const onTeamStoreUpdate = React.useCallback(
    (updatedTeam: Set<string>) => {
      if (!updatedTeam.has(team.id)) {
        return;
      }

      const newTeam = TeamStore.getById(team.id);

      if (!newTeam) {
        return;
      }

      setTeam(newTeam);
    },
    [team, TeamStore]
  );

  React.useEffect(() => {
    const unsubscribeTeam = TeamStore.listen(
      (teamSet: Set<string>) => onTeamStoreUpdate(teamSet),
      undefined
    );

    return () => unsubscribeTeam();
  }, [onTeamStoreUpdate]);

  return <Badge {...props} team={team} />;
}

export {TeamBadge};
