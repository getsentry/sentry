import styled from '@emotion/styled';

import AsyncComponent from 'sentry/components/asyncComponent';
import PageHeading from 'sentry/components/pageHeading';
import {Panel} from 'sentry/components/panels';
import ConfigStore from 'sentry/stores/configStore';
import {PageContent} from 'sentry/styles/organization';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

import WorkspaceCard from './components/workspaceCard';
import WorkspaceRow from './components/workspaceRow';
import {Workspace, workspaces} from './types';

type WorkspacesIndexProps = AsyncComponent['props'] & {
  organization: Organization;
};

type WorkspacesIndexState = AsyncComponent['state'] & {};

class WorkspacesIndex extends AsyncComponent<WorkspacesIndexProps, WorkspacesIndexState> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    return [['userTeams', `/organizations/${organization.slug}/user-teams/`]];
  }

  renderBody() {
    const user = ConfigStore.get('user');
    const {organization: _organization} = this.props;
    const {userTeams} = this.state;
    const workspaceMap: {
      all: Workspace[];
      member: Workspace[];
    } = workspaces.reduce(
      (map, workspace) => {
        const isTeamMember =
          workspace?.members[0].type === 'team' &&
          userTeams.some(team => team.id === workspace.members[0].id);
        const isUserMember =
          workspace?.members[0].type === 'user' && workspace.members[0].id === user.id;
        return isTeamMember || isUserMember
          ? {...map, member: [...map.member, workspace]}
          : {...map, all: [...map.all, workspace]};
      },
      {member: [] as Workspace[], all: [] as Workspace[]}
    );
    return (
      <PageContent>
        <PageHeading withMargins>Your Workspaces</PageHeading>
        <CardContainer>
          {workspaceMap.member.map(workspace => (
            <WorkspaceCard key={workspace.id} workspace={workspace} />
          ))}
        </CardContainer>
        <PageHeading withMargins>Other Workspaces</PageHeading>
        <Panel>
          {workspaceMap.all.map(workspace => (
            <WorkspaceRow key={workspace.id} workspace={workspace} />
          ))}
        </Panel>
      </PageContent>
    );
  }
}

const CardContainer = styled('div')`
  display: flex;
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  align-items: flex-start;
`;

export default withOrganization(WorkspacesIndex);
