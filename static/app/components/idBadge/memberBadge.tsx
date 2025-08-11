import type {Member} from 'sentry/types/organization';
import type {AvatarUser} from 'sentry/types/user';
import useOrganization from 'sentry/utils/useOrganization';

import UserBadge, {type UserBadgeProps} from './userBadge';

export interface MemberBadgeProps extends Omit<UserBadgeProps, 'user'> {
  member: Member;
  /**
   * Do not link to the members page
   */
  disableLink?: boolean;
}

function getMemberUser(member: Member): AvatarUser {
  if (member.user) {
    return member.user;
  }
  // Adapt the member into a AvatarUser
  return {
    id: '',
    name: member.name,
    email: member.email,
    username: '',
    ip_address: '',
  };
}

function MemberBadge({member, disableLink, ...props}: MemberBadgeProps) {
  const user = getMemberUser(member);
  const org = useOrganization({allowNull: true});

  const membersUrl =
    member && org && !disableLink
      ? `/settings/${org.slug}/members/${member.id}/`
      : undefined;

  return <UserBadge to={membersUrl} user={user} {...props} />;
}

export default MemberBadge;
