import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Link from 'sentry/components/links/link';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconSettings, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import space from 'sentry/styles/space';
import type {Actor, Group, Organization, Project} from 'sentry/types';
import {buildTeamId} from 'sentry/utils';

interface OwnedByProps {
  group: Group;
  organization: Organization;
  project: Project;
}

function OwnedBy({group, project, organization}: OwnedByProps) {
  const memberList = useLegacyStore(MemberListStore);
  const owner = group.owners?.[0];
  let currentOwner: Actor | undefined;

  const teams = project?.teams ?? [];
  const assignableTeams = teams
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map(team => ({
      id: buildTeamId(team.id),
      display: `#${team.slug}`,
      email: team.id,
      team,
    }));

  // converts a backend suggested owner to a suggested assignee
  if (owner) {
    const [ownerType, id] = owner.owner.split(':');
    if (ownerType === 'user') {
      const member = memberList.find(user => user.id === id);
      if (member) {
        currentOwner = {
          type: 'user',
          id,
          name: member.name,
        };
      }
    } else if (ownerType === 'team') {
      const matchingTeam = assignableTeams.find(
        assignableTeam => assignableTeam.id === owner.owner
      );
      if (matchingTeam) {
        currentOwner = {
          type: 'team',
          id,
          name: matchingTeam.team.name,
        };
      }
    }
  }

  return (
    <SidebarSection.Wrap>
      <SidebarSection.Title>{t('Owned By')}</SidebarSection.Title>
      <StyledSidebarContent>
        <ActorWrapper>
          {currentOwner ? (
            <ActorAvatar
              data-test-id="owner-avatar"
              actor={currentOwner}
              hasTooltip={false}
              size={20}
            />
          ) : (
            <IconUser size="md" />
          )}
          <div>
            {currentOwner?.type === 'team'
              ? `#${currentOwner?.name}`
              : currentOwner?.name ?? t('No-one')}
          </div>
        </ActorWrapper>

        <StyledLink
          to={`/settings/${organization.slug}/projects/${project.slug}/ownership/`}
        >
          <IconSettings />
        </StyledLink>
      </StyledSidebarContent>
    </SidebarSection.Wrap>
  );
}

export default OwnedBy;

const ActorWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const StyledSidebarContent = styled(SidebarSection.Content)`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const StyledLink = styled(Link)`
  display: flex;
  align-items: center;
  color: ${p => p.theme.textColor};
`;
