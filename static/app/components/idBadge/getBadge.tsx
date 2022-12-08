import type {BaseBadgeProps} from 'sentry/components/idBadge/baseBadge';
import MemberBadge, {MemberBadgeProps} from 'sentry/components/idBadge/memberBadge';
import OrganizationBadge, {
  OrganizationBadgeProps,
} from 'sentry/components/idBadge/organizationBadge';
import ProjectBadge, {ProjectBadgeProps} from 'sentry/components/idBadge/projectBadge';
import {TeamBadge} from 'sentry/components/idBadge/teamBadge';
import UserBadge, {UserBadgeProps} from 'sentry/components/idBadge/userBadge';

import {TeamBadgeProps} from './teamBadge/badge';

type DisplayName = BaseBadgeProps['displayName'];

interface AddedBaseBadgeProps {
  displayName?: DisplayName;
}
interface GetOrganizationBadgeProps
  extends AddedBaseBadgeProps,
    Omit<BaseBadgeProps, 'displayName' | 'organization'>,
    OrganizationBadgeProps {}

interface GetMemberBadgeProps
  extends Omit<BaseBadgeProps, 'displayName' | 'member'>,
    AddedBaseBadgeProps,
    MemberBadgeProps {}

interface GetUserBadgeProps
  extends Omit<BaseBadgeProps, 'displayName' | 'user'>,
    UserBadgeProps,
    AddedBaseBadgeProps {}

interface GetTeamBadgeProps
  extends Omit<BaseBadgeProps, 'displayName' | 'team'>,
    TeamBadgeProps,
    AddedBaseBadgeProps {}

interface GetProjectBadgeProps
  extends Omit<BaseBadgeProps, 'displayName' | 'project'>,
    ProjectBadgeProps,
    AddedBaseBadgeProps {}

export type GetBadgeProps =
  | GetOrganizationBadgeProps
  | GetTeamBadgeProps
  | GetProjectBadgeProps
  | GetUserBadgeProps
  | GetMemberBadgeProps;

function getBadge(props): React.ReactElement | null {
  if (props.organization) {
    return <OrganizationBadge {...props} />;
  }
  if (props.team) {
    return <TeamBadge {...props} />;
  }
  if (props.project) {
    return <ProjectBadge {...props} />;
  }
  if (props.user) {
    return <UserBadge {...props} />;
  }
  if (props.member) {
    return <MemberBadge {...props} />;
  }

  return null;
}

export default getBadge;
