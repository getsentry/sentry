import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Team} from 'sentry/types/organization';

import BadgeDisplayName from './badgeDisplayName';
import {BaseBadge, type BaseBadgeProps} from './baseBadge';

export interface TeamBadgeProps extends BaseBadgeProps {
  team: Team;
  /**
   * When true will default max-width, or specify one as a string
   */
  hideOverflow?: boolean | string;
}

function TeamBadge({hideOverflow = true, team, ...props}: TeamBadgeProps) {
  const {teams} = useLegacyStore(TeamStore);

  // Get the most up-to-date team from the store
  const resolvedTeam = teams.find(t => t.id === team.id) ?? team;
  const teamName = `#${resolvedTeam.slug}`;

  return (
    <BaseBadge
      displayName={
        <BadgeDisplayName hideOverflow={hideOverflow}>{teamName}</BadgeDisplayName>
      }
      team={resolvedTeam}
      {...props}
    />
  );
}

export {TeamBadge};
