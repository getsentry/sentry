import {hasEveryAccess} from 'sentry/components/acl/access';
import type {Project, Scope, Team} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

type Props = {
  /**
   * List of required access levels
   */
  access?: Scope[];
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

export function useAccess({access = [], team, project}: Props) {
  const user = useUser();
  const organization = useOrganization();

  team = team ?? undefined;
  project = project ?? undefined;

  const hasAccess = hasEveryAccess(access, {organization, team, project});
  const hasSuperuser = Boolean(user?.isSuperuser);

  return {
    hasAccess,
    hasSuperuser,
  };
}
