import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

import type {TeamBadgeProps} from './badge';
import Badge from './badge';

function TeamBadge(props: TeamBadgeProps) {
  const {teams} = useLegacyStore(TeamStore);

  // Get the most up-to-date team from the store
  const teamFromStore = teams.find(t => t.id === props.team.id);

  return <Badge {...props} team={teamFromStore ?? props.team} />;
}

export {TeamBadge};
