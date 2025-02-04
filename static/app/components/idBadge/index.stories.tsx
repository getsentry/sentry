import LoadingIndicator from 'sentry/components/loadingIndicator';
import storyBook from 'sentry/stories/storyBook';
import type {Actor} from 'sentry/types/core';
import type {Member} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useTeams} from 'sentry/utils/useTeams';
import {useUser} from 'sentry/utils/useUser';

import Matrix, {type PropMatrix} from '../stories/matrix';
import SideBySide from '../stories/sideBySide';

import type {OrganizationBadgeProps} from './organizationBadge';
import IdBadge from '.';

export default storyBook('IdBadge', story => {
  story('Props', () => {
    const org = useOrganization();

    const propMatrix: PropMatrix<OrganizationBadgeProps> = {
      avatarSize: [12, 16, 24],
    };

    return (
      <Matrix<OrganizationBadgeProps>
        render={props => <IdBadge {...props} organization={org} />}
        propMatrix={propMatrix}
        selectedProps={['avatarSize']}
      />
    );
  });

  story('Organization', () => {
    const org = useOrganization();
    return <IdBadge organization={org} />;
  });

  story('Team', () => {
    const {teams} = useTeams();

    if (teams.length === 0) {
      return <LoadingIndicator />;
    }

    return <IdBadge team={teams[0]!} />;
  });

  story('Project', () => {
    const {projects} = useProjects();
    const myProject = projects.filter(p => p.isMember);

    if (myProject.length === 0) {
      return <LoadingIndicator />;
    }

    return <IdBadge project={myProject[0]!} />;
  });

  story('User', () => {
    const user = useUser();
    return <IdBadge user={user} />;
  });

  story('Member', () => {
    const user = useUser();

    // XXX(epurkhiser): There's no easy way to get a member, so just use a
    // "mock" member
    const member: Member = {
      dateCreated: '',
      email: user.email,
      expired: false,
      id: '0',
      inviteStatus: 'approved',
      invite_link: null,
      inviterName: null,
      isOnlyOwner: false,
      name: user.name,
      orgRole: 'member',
      orgRoleList: [],
      pending: false,
      projects: [],
      role: '',
      roleName: 'Member',
      /**
       * @deprecated use orgRoleList
       */
      roles: [],
      teamRoleList: [],
      teamRoles: [],
      teams: [],
      user,
      flags: {
        'idp:provisioned': false,
        'idp:role-restricted': false,
        'member-limit:restricted': false,
        'partnership:restricted': false,
        'sso:invalid': false,
        'sso:linked': false,
      },
    };

    return <IdBadge member={member} />;
  });

  story('Actor', () => {
    const user = useUser();
    const {teams} = useTeams();

    const userActor: Actor = {
      type: 'user',
      id: user.id,
      name: user.name,
      email: user.email,
    };

    const teamActor: Actor = {
      type: 'team',
      id: teams[0]!.id,
      name: teams[0]!.name,
    };

    return (
      <SideBySide>
        <IdBadge actor={userActor} />
        <IdBadge actor={teamActor} />
      </SideBySide>
    );
  });
});
