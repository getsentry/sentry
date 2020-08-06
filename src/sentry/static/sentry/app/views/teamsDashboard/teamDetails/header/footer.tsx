import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import AvatarList from 'app/components/avatar/avatarList';
import {User, Project, Environment} from 'app/types';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import {IconArrow} from 'app/icons';

import FooterItem from './footerItem';
import {getSelectedEnvironments} from '../utils';
import withLocalStorage, {InjectedLocalStorageProps} from '../../withLocalStorage';
import {TAB} from '../../utils';

type Props = {
  teamSlug: string;
  users: Array<User>;
  projects: Array<Project>;
  enviroments: Array<Environment>;
} & InjectedLocalStorageProps;

const Footer = ({users, projects, teamSlug, data}: Props) => {
  const selectedEnvironments = getSelectedEnvironments(teamSlug, data);

  return (
    <Wrapper>
      {projects.length > 0 && (
        <FooterItem
          title={t('Team Projects')}
          items={projects.map(project => (
            <ProjectBadge key={project.id} project={project} avatarSize={16} />
          ))}
        />
      )}
      {selectedEnvironments.length > 0 && (
        <FooterItem title={t('Team Environments')} items={selectedEnvironments} />
      )}
      {users.length > 0 && (
        <FooterItem title={t('Team Members')}>
          <StyledAvatarList users={users} avatarSize={35} />
        </FooterItem>
      )}
      <FooterItem title={t('Q3 Apdex Goal')}>
        <GoalContainer>
          <CurrentGoalNumber>0.964</CurrentGoalNumber>
          <UpArrow>
            <IconArrow direction="up" />
          </UpArrow>
        </GoalContainer>
      </FooterItem>
      <FooterItem title={t('Q3 Miserable Users Goal')}>
        <GoalContainer>
          <CurrentGoalNumber>{Number(2749).toLocaleString()}</CurrentGoalNumber>
          <DownArrow>
            <IconArrow direction="down" />
          </DownArrow>
        </GoalContainer>
      </FooterItem>
    </Wrapper>
  );
};

export default withLocalStorage(Footer, TAB.DASHBOARD);

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content max-content max-content;
  grid-auto-flow: column;
  grid-gap: 60px;
`;

const GoalContainer = styled('div')`
  display: flex;
  align-items: center;

  > * + * {
    margin-left: 8px;
  }
`;

const StyledAvatarList = styled(AvatarList)`
  flex-direction: row;
  .avatar {
    margin-left: 0;
  }
`;

const CurrentGoalNumber = styled('div')`
  font-size: ${p => p.theme.headerFontSize};
  line-height: 1.2;
`;

const UpArrow = styled('div')`
  color: ${p => p.theme.green500};
  display: flex;
  align-items: center;
`;

const DownArrow = styled('div')`
  color: ${p => p.theme.red500};
  display: flex;
  align-items: center;
`;
