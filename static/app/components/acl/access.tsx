import {Fragment} from 'react';

import ConfigStore from 'sentry/stores/configStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {Organization, Project, Scope, Team} from 'sentry/types';
import {isRenderFunc} from 'sentry/utils/isRenderFunc';
import withOrganization from 'sentry/utils/withOrganization';

// Props that function children will get.
type ChildRenderProps = {
  hasAccess: boolean;
  hasSuperuser: boolean;
};

type ChildFunction = (props: ChildRenderProps) => JSX.Element;

type Props = {
  organization: Organization;
  /**
   * List of required access levels
   */
  access?: Scope[];
  /**
   * Children can be a node or a function as child.
   */
  children?: React.ReactNode | ChildFunction;

  /**
   * Requires superuser
   */
  isSuperuser?: boolean;

  /**
   * Optional: To be used when you need to check for access to the Project
   *
   * E.g. On the project settings page, the user will need project:write.
   * An "org-member" does not have project:write but if they are "team-admin" for
   * of a parent team, they will have appropriate scopes.
   */
  project?: Project | null | undefined;
  /**
   * Optional: To be used when you need to check for access to the Team
   *
   * E.g. On the team settings page, the user will need team:write.
   * An "org-member" does not have team:write but if they are "team-admin" for
   * the team, they will have appropriate scopes.
   */
  team?: Team | null | undefined;
};

/**
 * Component to handle access restrictions.
 */
function Access({
  children,
  isSuperuser = false,
  access = [],
  team,
  project,
  organization,
}: Props) {
  const config = useLegacyStore(ConfigStore);
  team = team ?? undefined;
  project = project ?? undefined;

  const hasAccess = hasEveryAccess(access, {organization, team, project});
  const hasSuperuser = !!(config.user && config.user.isSuperuser);

  const renderProps: ChildRenderProps = {
    hasAccess,
    hasSuperuser,
  };

  const render = hasAccess && (!isSuperuser || hasSuperuser);

  if (isRenderFunc<ChildFunction>(children)) {
    return children(renderProps);
  }

  return <Fragment>{render ? children : null}</Fragment>;
}

export function hasEveryAccess(
  access: Scope[],
  props: {organization?: Organization; project?: Project; team?: Team}
) {
  const {organization, team, project} = props;
  const {access: orgAccess} = organization || {access: [] as Organization['access']};
  const {access: teamAccess} = team || {access: [] as Team['access']};
  const {access: projAccess} = project || {access: [] as Project['access']};

  return (
    !access ||
    access.every(acc => orgAccess.includes(acc)) ||
    access.every(acc => teamAccess?.includes(acc)) ||
    access.every(acc => projAccess?.includes(acc))
  );
}

export default withOrganization(Access);
