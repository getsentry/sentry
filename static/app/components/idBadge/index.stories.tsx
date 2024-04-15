import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import storyBook from 'sentry/stories/storyBook';
import {Member} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useTeams} from 'sentry/utils/useTeams';

import IdBadge from '.';

export default storyBook(IdBadge, story => {
  story('Organization', () => {
    const org = useOrganization();
    return <IdBadge organization={org} />;
  });

  story('Team', () => {
    const {teams} = useTeams();
    return <IdBadge team={teams[0]} />;
  });

  story('Project', () => {
    const {projects} = useProjects();
    const myProject = projects.filter(p => p.isMember);

    return <IdBadge project={myProject[0]} />;
  });

  story('User', () => {
    const {user} = useLegacyStore(ConfigStore);
    return <IdBadge user={user} />;
  });

  story('Member', () => {
    const {user} = useLegacyStore(ConfigStore);

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
      user: user,
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
});
