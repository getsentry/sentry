import styled from '@emotion/styled';

import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import Button from 'sentry/components/button';
import {PanelItem} from 'sentry/components/panels';
import space from 'sentry/styles/space';

import {Workspace} from '../types';

type WorkspaceRowProps = {
  workspace: Workspace;
};

const WorkspaceRow = ({workspace}: WorkspaceRowProps) => {
  const {name, description, members} = workspace;
  return (
    <PanelItem>
      <WorkspaceContainer>
        <WorkspaceName>{name}</WorkspaceName>
        <WorkspaceDescription>{description}</WorkspaceDescription>
        <ButtonUserContainer>
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
          <Button>Request Access</Button>
        </ButtonUserContainer>
      </WorkspaceContainer>
    </PanelItem>
  );
};

const WorkspaceContainer = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
`;

export const WorkspaceName = styled('p')`
  margin-bottom: ${space(0.5)};
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
  flex: 1;
`;

export const WorkspaceDescription = styled('p')`
  color: ${p => p.theme.subText};
  margin-bottom: ${space(2)};
`;

export const WorkspaceMembers = styled('div')`
  display: flex;
  justify-content: flex-start;
`;

export const WorkspaceMember = styled('div')`
  margin: ${space(0.25)} ${space(1)} ${space(0.25)} ${space(0.5)};
  display: grid;
  grid-template-columns: 25px auto;
  align-items: center;
`;

const ButtonUserContainer = styled('div')`
  display: grid;
  grid-template-columns: 1fr 140px;
`;

export default WorkspaceRow;
