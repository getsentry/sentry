import React from 'react';

import {Organization} from 'app/types';
import ConfigStore from 'app/stores/configStore';
import withOrganization from 'app/utils/withOrganization';
import {isRenderFunc} from 'app/utils/isRenderFunc';

type RoleRenderProps = {
  hasRole: boolean;
};

type ChildrenRenderFn = (props: RoleRenderProps) => React.ReactNode;

type Props = {
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
  children: React.ReactNode | ChildrenRenderFn;
};

class Role extends React.Component<Props> {
  hasRole() {
    const user = ConfigStore.get('user');
    const {organization, role} = this.props;
    const {availableRoles} = organization;
    const currentRole = organization.role ?? '';

    if (!user) {
      return false;
    }

    if (user.isSuperuser) {
      return true;
    }

    if (!Array.isArray(availableRoles)) {
      return false;
    }

    const roleIds = availableRoles.map(r => r.id);

    if (!roleIds.includes(role) || !roleIds.includes(currentRole)) {
      return false;
    }

    const requiredIndex = roleIds.indexOf(role);
    const currentIndex = roleIds.indexOf(currentRole);
    return currentIndex >= requiredIndex;
  }

  render() {
    const {children} = this.props;
    const hasRole = this.hasRole();

    if (isRenderFunc<ChildrenRenderFn>(children)) {
      return children({hasRole});
    }

    return hasRole && children ? children : null;
  }
}

export default withOrganization(Role);
