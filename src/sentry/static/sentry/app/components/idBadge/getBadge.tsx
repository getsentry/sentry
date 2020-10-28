import React from 'react';

import BaseBadge from 'app/components/idBadge/baseBadge';
import MemberBadge from 'app/components/idBadge/memberBadge';
import UserBadge from 'app/components/idBadge/userBadge';
import TeamBadge from 'app/components/idBadge/teamBadge/badge';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import OrganizationBadge from 'app/components/idBadge/organizationBadge';
import {Member, User} from 'app/types';

type BaseBadgeProps = React.ComponentProps<typeof BaseBadge>;
type DisplayName = BaseBadgeProps['displayName'];

type Props = Omit<BaseBadgeProps, 'displayName'> & {
  user?: User;
  member?: Member;
  displayName?: DisplayName;
};

function getBadge({organization, team, project, user, member, ...props}: Props) {
  if (organization) {
    return <OrganizationBadge organization={organization} {...props} />;
  }
  if (team) {
    return <TeamBadge team={team} {...props} />;
  }
  if (project) {
    return <ProjectBadge project={project} {...props} />;
  }
  if (user) {
    return <UserBadge user={user} {...props} />;
  }
  if (member) {
    return <MemberBadge member={member} {...props} />;
  }

  return null;
}

export default getBadge;
