import * as React from 'react';

import BaseBadge from 'sentry/components/idBadge/baseBadge';
import MemberBadge from 'sentry/components/idBadge/memberBadge';
import OrganizationBadge from 'sentry/components/idBadge/organizationBadge';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {TeamBadge} from 'sentry/components/idBadge/teamBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import {Member, User} from 'sentry/types';

type BaseBadgeProps = React.ComponentProps<typeof BaseBadge>;
type DisplayName = BaseBadgeProps['displayName'];

type Props = Omit<BaseBadgeProps, 'displayName'> & {
  displayName?: DisplayName;
  member?: Member;
  user?: User;
};

function getBadge({
  organization,
  team,
  project,
  user,
  member,
  ...props
}: Props): React.ReactElement | null {
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
