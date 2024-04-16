import type {BaseBadgeProps} from './baseBadge';
import MemberBadge, {type MemberBadgeProps} from './memberBadge';
import OrganizationBadge, {type OrganizationBadgeProps} from './organizationBadge';
import ProjectBadge, {type ProjectBadgeProps} from './projectBadge';
import {TeamBadge, type TeamBadgeProps} from './teamBadge';
import UserBadge, {type UserBadgeProps} from './userBadge';

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
