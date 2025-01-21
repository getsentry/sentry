import ActorBadge, {type ActorBadgeProps} from './actorBadge';
import type {BaseBadgeProps} from './baseBadge';
import MemberBadge, {type MemberBadgeProps} from './memberBadge';
import OrganizationBadge, {type OrganizationBadgeProps} from './organizationBadge';
import ProjectBadge, {type ProjectBadgeProps} from './projectBadge';
import {TeamBadge, type TeamBadgeProps} from './teamBadge';
import UserBadge, {type UserBadgeProps} from './userBadge';

interface AddedBaseBadgeProps {
  displayName?: React.ReactNode;
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

interface GetActorBadgeProps
  extends Omit<BaseBadgeProps, 'displayName' | 'actor'>,
    ActorBadgeProps,
    AddedBaseBadgeProps {}

export type GetBadgeProps =
  | GetOrganizationBadgeProps
  | GetTeamBadgeProps
  | GetProjectBadgeProps
  | GetUserBadgeProps
  | GetMemberBadgeProps
  | GetActorBadgeProps;

function getBadge(props: any): React.ReactElement | null {
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
  if (props.actor) {
    return <ActorBadge {...props} />;
  }
  if (props.member) {
    return <MemberBadge {...props} />;
  }

  return null;
}

export default getBadge;
