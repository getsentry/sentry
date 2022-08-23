import styled from '@emotion/styled';

import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import Card from 'sentry/components/card';
import space from 'sentry/styles/space';

import {Workspace} from '../types';

import {WorkspaceDescription, WorkspaceMember, WorkspaceMembers} from './workspaceRow';

type WorkspaceCardProps = {
  workspace: Workspace;
};

const WorkspaceCard = ({workspace}: WorkspaceCardProps) => {
  const {name, description, members} = workspace;
  return (
    <StyledCard>
      <WorkspaceName>{name}</WorkspaceName>
      <WorkspaceDescription>{description}</WorkspaceDescription>
      <WorkspaceMembers>
        {members.map(member => (
          <WorkspaceMember key={member.id}>
            <div>
              {member.type === 'user' ? (
                <UserAvatar user={member} />
              ) : (
                <TeamAvatar team={member} />
              )}
            </div>
            <div>{member.name}</div>
          </WorkspaceMember>
        ))}
      </WorkspaceMembers>
    </StyledCard>
  );
};

const StyledCard = styled(Card)`
  flex: 1;
  max-width: 500px;
  min-width: 200px;
  padding: ${space(2)};
`;

const WorkspaceName = styled('a')`
  margin-bottom: ${space(0.5)};
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
`;

export default WorkspaceCard;
