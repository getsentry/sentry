import styled from '@emotion/styled';

import {AvatarList, CollapsedAvatars, TeamAvatar} from '@sentry/scraps/avatar';
import {Tag} from '@sentry/scraps/badge';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import type {User} from 'sentry/types/user';
import {defined} from 'sentry/utils/defined';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import type {DashboardDetails, DashboardListItem} from 'sentry/views/dashboards/types';

const AVATAR_SIZE = 30;
const ALL_BADGE_SIZE = 26;

interface EditAccessAvatarsProps {
  dashboard: DashboardDetails | DashboardListItem;
}

/**
 * Read-only summary of who can edit a dashboard: an "All" badge when anyone
 * can, otherwise the creator's avatar plus the teams that were granted access.
 */
export function EditAccessAvatars({dashboard}: EditAccessAvatarsProps) {
  const dashboardCreator = dashboard.createdBy;
  const isEditableByEveryone =
    !defined(dashboard.permissions) || dashboard.permissions.isEditableByEveryone;
  const teamIds = (dashboard.permissions?.teamsWithEditAccess ?? []).map(String);

  const {teams} = useTeamsById({ids: teamIds});
  const selectedTeams = teamIds.length > 0 ? teams : [];

  if (isEditableByEveryone || !dashboardCreator) {
    return (
      <AllBadge size={ALL_BADGE_SIZE} variant="info">
        {t('All')}
      </AllBadge>
    );
  }

  if (selectedTeams.length === 1) {
    return (
      <StyledAvatarList
        typeAvatars="users"
        users={[dashboardCreator]}
        teams={selectedTeams}
        maxVisibleAvatars={1}
        avatarSize={AVATAR_SIZE}
        renderUsersFirst
      />
    );
  }

  const creatorStack = Array.from<User>({length: selectedTeams.length + 1}).fill(
    dashboardCreator
  );

  return (
    <StyledAvatarList
      typeAvatars="users"
      users={creatorStack}
      maxVisibleAvatars={1}
      avatarSize={AVATAR_SIZE}
      renderCollapsedAvatars={(_avatarSize, numCollapsedAvatars) => (
        <Tooltip
          title={
            selectedTeams.length > 1 ? (
              <TeamList gap="md">
                {selectedTeams.map(team => (
                  <Flex align="center" gap="md" key={team.id}>
                    <TeamAvatar team={team} size={18} />
                    <div>#{team.name}</div>
                  </Flex>
                ))}
              </TeamList>
            ) : null
          }
          overlayStyle={{pointerEvents: 'auto', zIndex: 1000}}
        >
          <CollapsedAvatars>
            {numCollapsedAvatars < 99 && <Plus>+</Plus>}
            {numCollapsedAvatars}
          </CollapsedAvatars>
        </Tooltip>
      )}
    />
  );
}

const StyledAvatarList = styled(AvatarList)`
  margin-left: ${p => p.theme.space.sm};
  font-weight: normal;
`;

const AllBadge = styled(Tag)<{size: number}>`
  padding: 0;
  height: ${p => p.size}px;
  width: ${p => p.size}px;
  display: flex;
  justify-content: center;
  align-items: center;
  margin-left: 0;
`;

const TeamList = styled(Stack)`
  max-height: 200px;
  overflow-y: auto;
`;

const Plus = styled('span')`
  font-size: 10px;
  margin-left: 1px;
  margin-right: -1px;
`;
