import * as React from 'react';

import ConfigStore from 'sentry/stores/configStore';
import {Organization, User} from 'sentry/types';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {isRenderFunc} from 'sentry/utils/isRenderFunc';
import withOrganization from 'sentry/utils/withOrganization';

type RoleRenderProps = {
  hasRole: boolean;
};

type ChildrenRenderFn = (props: RoleRenderProps) => React.ReactElement;

function checkUserRole(user: User, organization: Organization, role: RoleProps['role']) {
  if (!user) {
    return false;
  }

  if (isActiveSuperuser()) {
    return true;
  }

  if (!Array.isArray(organization.availableRoles)) {
    return false;
  }

  const roleIds = organization.availableRoles.map(r => r.id);

  if (!roleIds.includes(role) || !roleIds.includes(organization.role ?? '')) {
    return false;
  }

  const requiredIndex = roleIds.indexOf(role);
  const currentIndex = roleIds.indexOf(organization.role ?? '');
  return currentIndex >= requiredIndex;
}

interface RoleProps {
  /**
   * Minimum required role
   */
  role: string;
  /**
   * Current Organization
   */
  organization: Organization;
  /**
   * If children is a function then will be treated as a render prop and
   * passed RoleRenderProps.
   *
   * The other interface is more simple, only show `children` if user has
   * the minimum required role.
   */
  children: React.ReactElement | ChildrenRenderFn;
}

function Role({role, organization, children}: RoleProps): React.ReactElement | null {
  const hasRole = React.useMemo(
    () => checkUserRole(ConfigStore.get('user'), organization, role),
    // It seems that this returns a stable reference, but
    [organization, role, ConfigStore.get('user')]
  );

  if (isRenderFunc<ChildrenRenderFn>(children)) {
    return children({hasRole});
  }

  return hasRole ? children : null;
}

export default withOrganization(Role);
