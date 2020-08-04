import React from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import {t} from 'app/locale';
import {Team} from 'app/types';
import Avatar from 'app/components/avatar';
import Breadcrumbs from 'app/components/breadcrumbs';
import space from 'app/styles/space';
import Button from 'app/components/button';
import {IconMegaphone} from 'app/icons';
import AvatarList from 'app/components/avatar/avatarList';

type Props = {
  team: Team;
  orgSlug: string;
  teamSlug: string;
  origin: 'my-teams' | 'all-teams';
};

type State = {
  crumbs: Array<any>;
};

class TeamDetailsHeader extends React.Component<Props, State> {
  state: State = {crumbs: []};

  componentDidMount() {
    this.getCrumbs();
  }

  getCrumbs() {
    const {origin, orgSlug, teamSlug} = this.props;

    const crumbs = [
      {
        to: `/organizations/${orgSlug}/teams/`,
        label: t('Teams'),
        preserveGlobalSelection: true,
      },
      {
        to: `/organizations/${orgSlug}/teams/my-teams/`,
        label: t('My Teams'),
        preserveGlobalSelection: true,
      },
      {label: teamSlug},
    ];

    if (origin === 'all-teams') {
      crumbs[1] = {
        to: `/organizations/${orgSlug}/teams/all-teams/`,
        label: t('All Teams'),
        preserveGlobalSelection: true,
      };
    }

    this.setState({crumbs});
  }

  render() {
    const {team} = this.props;
    const {members = []} = team;
    return (
      <Wrapper>
        <Header>
          <Breadcrumbs crumbs={this.state.crumbs} />
          {team.isMember ? (
            <Button priority="primary" icon={<IconMegaphone />}>
              {t('Request to Join')}
            </Button>
          ) : (
            <Button>{t('Leave Team')}</Button>
          )}
        </Header>
        <Body>
          <Avatar team={team} size={90} />
          <DetailsContainer>
            <Details>
              <Title>{capitalize(team.slug)}</Title>
              <div>This is copy about the team.</div>
            </Details>
          </DetailsContainer>
        </Body>
        <Footer>
          <FooterItem>
            <FooterItemTitle>{t('Team Projects')}</FooterItemTitle>
            content goes here
          </FooterItem>
          <FooterItem>
            <FooterItemTitle>{t('Team Enviroments')}</FooterItemTitle>
            content goes here
          </FooterItem>
          <FooterItem>
            <FooterItemTitle>{t('Team Members')}</FooterItemTitle>
            <StyledAvatarList users={members as any} avatarSize={35} />
          </FooterItem>
        </Footer>
      </Wrapper>
    );
  }
}

export default TeamDetailsHeader;

const Wrapper = styled('div')`
  display: grid;
  grid-gap: ${space(2)};
`;

const Header = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
`;

const Body = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(3)};
`;

const DetailsContainer = styled('div')`
  display: grid;
  grid-gap: ${space(1.5)};
`;

const Details = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  color: ${p => p.theme.gray500};
`;

const Title = styled('h5')`
  width: 100%;
  font-size: ${p => p.theme.headerFontSize};
  font-weight: 400;
  margin-bottom: ${space(1)};
  color: ${p => p.theme.gray700};
`;

const Footer = styled('div')`
  display: grid;
  grid-template-columns: max-content max-content max-content;
  grid-gap: ${space(4)};
`;

const FooterItem = styled('div')``;

const FooterItemTitle = styled('div')`
  color: ${p => p.theme.gray600};
  text-transform: uppercase;
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StyledAvatarList = styled(AvatarList)`
  justify-content: center;
  .avatar {
    margin-left: 0;
  }
`;
