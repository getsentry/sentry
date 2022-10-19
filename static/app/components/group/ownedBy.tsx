import styled from '@emotion/styled';

import {openCreateOwnershipRule} from 'sentry/actionCreators/modal';
import Access from 'sentry/components/acl/access';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Button from 'sentry/components/button';
import Link from 'sentry/components/links/link';
import QuestionTooltip from 'sentry/components/questionTooltip';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconAdd, IconSettings, IconUser} from 'sentry/icons';
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
  const owner = group.owners?.find(({type}) =>
    ['codeowners', 'ownershipRule'].includes(type)
  );
  let currentOwner: Actor | undefined;

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
      const teams = project?.teams ?? [];
      const team = teams.find(({id: teamId}) => buildTeamId(teamId) === owner.owner);
      if (team) {
        currentOwner = {
          type: 'team',
          id,
          name: team.slug,
        };
      }
    }
  }

  return (
    <SidebarSection.Wrap>
      <StyledSidebarTitle>
        <TitleWrapper>
          {t('Owned By')}
          <QuestionTooltip
            position="top"
            title={t(
              'Set rules on which user or team owns an issue based on path, module, tag, or URL'
            )}
            size="sm"
            color="gray200"
          />
        </TitleWrapper>

        <ActionsWrapper>
          <Access access={['project:write']}>
            <Button
              type="button"
              onClick={() => {
                openCreateOwnershipRule({project, organization, issueId: group.id});
              }}
              aria-label={t('Create Ownership Rule')}
              icon={<IconAdd />}
              size="zero"
              borderless
            />
          </Access>
          <StyledLink
            to={`/settings/${organization.slug}/projects/${project.slug}/ownership/`}
            aria-label={t('Issue Owners Settings')}
          >
            <IconSettings />
          </StyledLink>
        </ActionsWrapper>
      </StyledSidebarTitle>
      <SidebarSection.Content>
        <ActorWrapper>
          {currentOwner ? (
            <ActorAvatar
              data-test-id="owner-avatar"
              actor={currentOwner}
              hasTooltip={false}
              size={24}
            />
          ) : (
            <IconWrapper>
              <IconUser size="md" />
            </IconWrapper>
          )}
          <ActorName>
            {currentOwner?.type === 'team'
              ? `#${currentOwner?.name}`
              : currentOwner?.name ?? t('No-one')}
          </ActorName>
        </ActorWrapper>
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}

export default OwnedBy;

const ActorWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  max-width: 85%;
  line-height: 1;
`;

const ActorName = styled('div')`
  line-height: 1.2;
  ${p => p.theme.overflowEllipsis}
`;

const IconWrapper = styled('div')`
  display: flex;
  padding: ${space(0.25)};
`;

const StyledLink = styled(Link)`
  display: flex;
  align-items: center;
  color: ${p => p.theme.textColor};
`;

const StyledSidebarTitle = styled(SidebarSection.Title)`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const TitleWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const ActionsWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
