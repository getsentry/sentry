import {useMemo} from 'react';

import ConfigStore from 'sentry/stores/configStore';
import {Organization, User} from 'sentry/types';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {isRenderFunc} from 'sentry/utils/isRenderFunc';
import withOrganization from 'sentry/utils/withOrganization';

type RoleRenderProps = {
  hasRole: boolean;
};

type ChildrenRenderFn = (props: RoleRenderProps) => React.ReactElement | null;

function checkUserRole(user: User, organization: Organization, role: RoleProps['role']) {
  if (!user) {
    return false;
  }

  if (isActiveSuperuser()) {
    return true;
  }

  if (!Array.isArray(organization.orgRoleList)) {
    return false;
  }

  const roleIds = organization.orgRoleList.map(r => r.id);

  if (!roleIds.includes(role) || !roleIds.includes(organization.orgRole ?? '')) {
    return false;
  }

  const requiredIndex = roleIds.indexOf(role);
  const currentIndex = roleIds.indexOf(organization.orgRole ?? '');
  return currentIndex >= requiredIndex;
}

interface RoleProps {
  /**
   * If children is a function then will be treated as a render prop and
   * passed RoleRenderProps.
   *
   * The other interface is more simple, only show `children` if user has
   * the minimum required role.
   */
  children: React.ReactElement | ChildrenRenderFn;
  /**
   * Current Organization
   */
  organization: Organization;
  /**
   * Minimum required role
   */
  role: string;
}

function Role({role, organization, children}: RoleProps): React.ReactElement | null {
  const user = ConfigStore.get('user');

  const hasRole = useMemo(
    () => checkUserRole(user, organization, role),
    // It seems that this returns a stable reference, but
    [organization, role, user]
  );

  if (isRenderFunc<ChildrenRenderFn>(children)) {
    return children({hasRole});
  }

  return hasRole ? children : null;
}

const withOrganizationRole = withOrganization(Role);

export {withOrganizationRole as Role};
