import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import space from 'app/styles/space';
import AvatarList from 'app/components/avatar/avatarList';
import {User, Project, Environment} from 'app/types';
import ProjectBadge from 'app/components/idBadge/projectBadge';

import FooterItem from './footerItem';

type Props = {
  users: Array<User>;
  projects: Array<Project>;
  enviroments: Array<Environment>;
};

const Footer = ({users, projects}: Props) => (
  <Wrapper>
    <FooterItem
      title={t('Team Projects')}
      items={projects.map(project => (
        <ProjectBadge key={project.id} project={project} avatarSize={16} />
      ))}
    />
    <FooterItem title={t('Team Environments')} items={['development', 'prod']} />
    <FooterItem title={t('Team Members')}>
      <StyledAvatarList users={users} avatarSize={35} />
    </FooterItem>
  </Wrapper>
);

export default Footer;

const Wrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content max-content max-content;
  grid-gap: 60px;
`;

const StyledAvatarList = styled(AvatarList)`
  flex-direction: row;
  .avatar {
    margin-left: 0;
  }
`;
