import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

import Badge, {BadgeProps} from './badge';

function TeamBadge(props: BadgeProps) {
  const {teams} = useLegacyStore(TeamStore);

  // Get the most up-to-date team from the store
  const teamFromStore = teams.find(t => t.id === props.team.id);

  return <Badge {...props} team={teamFromStore ?? props.team} />;
}

export {TeamBadge};
