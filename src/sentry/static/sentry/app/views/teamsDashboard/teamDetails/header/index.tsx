import React from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import {t} from 'app/locale';
import {Team, Project} from 'app/types';
import Avatar from 'app/components/avatar';
import Breadcrumbs from 'app/components/breadcrumbs';
import space from 'app/styles/space';
import Button from 'app/components/button';
import {IconMegaphone, IconEdit} from 'app/icons';
import {openModal} from 'app/actionCreators/modal';

import Footer from './footer';
import ModalEditAvatar from './modalEditAvatar';

type Props = {
  team: Team;
  orgSlug: string;
  teamSlug: string;
  origin: 'my-teams' | 'all-teams';
  projects: Array<Project>;
  canWrite: boolean;
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
        to: `/organizations/${orgSlug}/`,
        label: orgSlug,
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

  handleOpenEditAvatarModal = () => {
    const {canWrite, orgSlug, team} = this.props;

    openModal(modalProps => (
      <ModalEditAvatar
        {...modalProps}
        canWrite={canWrite}
        orgSlug={orgSlug}
        team={team}
      />
    ));
  };

  render() {
    const {team, projects} = this.props;

    return (
      <Wrapper>
        <Header>
          <Breadcrumbs crumbs={this.state.crumbs} />
          {!team.isMember ? (
            <Button priority="primary" icon={<IconMegaphone />}>
              {t('Request to Join')}
            </Button>
          ) : (
            <Button>{t('Leave Team')}</Button>
          )}
        </Header>
        <Body>
          <AvatarWrapper>
            <Avatar team={team} size={90} />
            <AvatarEditButton
              size="xsmall"
              icon={<IconEdit size="16px" />}
              onClick={this.handleOpenEditAvatarModal}
            />
          </AvatarWrapper>
          <DetailsContainer>
            <Details>
              <Title>{capitalize(team.slug)}</Title>
              <div>This is copy about the team.</div>
            </Details>
          </DetailsContainer>
        </Body>
        <Footer
          teamSlug={team.slug}
          users={team.members as Array<any>}
          projects={projects}
          enviroments={[]}
        />
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

const AvatarWrapper = styled('div')`
  position: relative;
`;

const AvatarEditButton = styled(Button)`
  position: absolute;
  transform: translate(50%, 50%);
  border-radius: 50%;
  bottom: ${space(1.5)};
  right: ${space(1.5)};
  height: 30px;
  width: 30px;
  :hover {
    background: ${p => p.theme.gray200};
  }
`;
