import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {Team, Organization, Member} from 'app/types';
import IdBadge from 'app/components/idBadge';
import Link from 'app/components/links/link';
import AsyncComponent from 'app/components/asyncComponent';
import AvatarList from 'app/components/avatar/avatarList';

type Props = AsyncComponent['props'] & {
  team: Team;
  organization: Organization;
  hasTeamAdminAccess: boolean;
};

type State = AsyncComponent['state'] & {
  members: Array<Member>;
};

class TeamCard extends AsyncComponent<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      members: [],
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, team} = this.props;
    return [['members', `/teams/${organization.slug}/${team.slug}/members/`]];
  }

  getFakeUsers() {
    const members: Array<Member> = this.state.members;
    for (let i = 0; i < 10; i++) {
      members.push({
        user: {
          id: String(i + 1),
          name: `Jane Bloggs ${i}`,
          email: 'janebloggs@example.com',
        },
        inviteStatus: 'requested_to_join',
      });
    }

    return members.filter(({user}) => !!user).map(({user}) => user);
  }

  renderBody() {
    const {hasTeamAdminAccess, organization, team} = this.props;
    const users = this.getFakeUsers();

    return (
      <Wrapper>
        <div>
          {hasTeamAdminAccess ? (
            <TeamLink to={`/organizations/${organization.slug}/teams/${team.slug}/`}>
              <IdBadge team={team} avatarSize={22} />
            </TeamLink>
          ) : (
            <IdBadge team={team} avatarSize={22} />
          )}
        </div>
        <Body>
          <Description>
            {
              'Curabitur ligula sapien, tincidunt non, euismod vitae, posuere imperdiet, leo. Maecenas malesuada. Praesent congue erat at massa.'
            }
          </Description>
          <AvatarList users={users} />
        </Body>
      </Wrapper>
    );
  }
}

export default TeamCard;

const Wrapper = styled('div')`
  background-color: ${p => p.theme.white};
  border: 1px solid ${p => p.theme.gray400};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowLight};
  padding: ${space(1)};
  display: grid;
  grid-gap: ${space(1)};
`;

const Body = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
`;

const Description = styled('div')`
  color: ${p => p.theme.gray500};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const TeamLink = styled(Link)`
  display: flex;
  align-items: center;
`;
