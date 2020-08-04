import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Team} from 'app/types';
import Avatar from 'app/components/avatar';
import Breadcrumbs from 'app/components/breadcrumbs';
import space from 'app/styles/space';
import Button from 'app/components/button';
import {IconMegaphone} from 'app/icons';

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
              <Title>{team.slug}</Title>
              <div>This is awesome copy and maybe should not even be here</div>
            </Details>
          </DetailsContainer>
        </Body>
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

const Title = styled('h5')`
  width: 100%;
  font-size: ${p => p.theme.headerFontSize};
  font-weight: 400;
  margin-bottom: 0;
`;

const DetailsContainer = styled('div')`
  display: grid;
  grid-gap: ${space(1.5)};
`;

const Details = styled('div')`
  display: grid;
  grid-gap: ${space(0.5)};
  color: ${p => p.theme.gray700};
`;
