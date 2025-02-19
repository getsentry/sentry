import type {Scope} from 'sentry/types/core';
import type {Organization, Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {isRenderFunc} from 'sentry/utils/isRenderFunc';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

// Props that function children will get.
type ChildRenderProps = {
  hasAccess: boolean;
  hasSuperuser: boolean;
};

// TODO(TS): This should be ReactNode but conflicts between react 17 & 18
type ChildFunction = (props: ChildRenderProps) => any;

type Props = {
  /**
   * List of required access levels
   */
  access: Scope[];
  /**
   * Children can be a node or a function as child.
   */
  children: React.ReactNode | ChildFunction;
  /**
   * Requires superuser
   */
  isSuperuser?: boolean;
  /**
   * Evaluate access against a defined organization. If this is not provided,
   * the access is evaluated against the currently active organization.
   */
  organization?: Organization;

  /**
   * Optional: To be used when you need to check for access to the Project
   *
   * E.g. On the project settings page, the user will need project:write.
   * An "org-member" does not have project:write but if they are "team-admin" for
   * of a parent team, they will have appropriate scopes.
   */
  project?: Project;
  /**
   * Optional: To be used when you need to check for access to the Team
   *
   * E.g. On the team settings page, the user will need team:write.
   * An "org-member" does not have team:write but if they are "team-admin" for
   * the team, they will have appropriate scopes.
   */
  team?: Team;
};

/**
 * Component to handle access restrictions.
 */
function Access({
  children,
  organization: overrideOrganization,
  isSuperuser,
  access,
  team,
  project,
}: Props) {
  const user = useUser();
  const implicitOrganization = useOrganization();
  const organization = overrideOrganization || implicitOrganization;

  const hasSuperuser = Boolean(user?.isSuperuser);
  const hasAccess = hasEveryAccess(access, {
    organization,
    team,
    project,
  });

  if (isRenderFunc(children)) {
    return children({
      hasAccess,
      hasSuperuser,
    });
  }

  const render = hasAccess && (!isSuperuser || hasSuperuser);
  return render ? children : null;
}

export function hasEveryAccess(
  access: Scope[],
  entities: {
    organization?: Organization | null;
    project?: Project | null;
    team?: Team | null;
  }
): boolean {
  const hasOrganizationAccess = entities.organization
    ? access.every(acc => entities.organization?.access?.includes(acc))
    : false;
  const hasTeamAccess = entities.team
    ? access.every(acc => entities.team?.access?.includes(acc))
    : false;
  const hasProjectAccess = entities.project
    ? access.every(acc => entities.project?.access?.includes(acc))
    : false;

  return !access.length || hasOrganizationAccess || hasTeamAccess || hasProjectAccess;
}

export default Access;
