import Access from 'sentry/components/acl/access';
import {Alert} from 'sentry/components/alert';
import {t} from 'sentry/locale';
import type {Scope} from 'sentry/types/core';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

interface Props extends React.ComponentPropsWithoutRef<typeof Alert> {
  access?: Scope[];
  project?: Project | null | undefined;
  team?: Team | null | undefined;
}

export const permissionAlertText = t(
  'These settings can only be edited by users with the organization-level owner, manager, or team-level admin roles.'
);

function PermissionAlert({access = ['project:write'], project, team, ...props}: Props) {
  return (
    <Access access={access} project={project} team={team}>
      {({hasAccess}) =>
        !hasAccess && (
          <Alert data-test-id="project-permission-alert" type="warning" {...props}>
            {permissionAlertText}
          </Alert>
        )
      }
    </Access>
  );
}

export default PermissionAlert;
