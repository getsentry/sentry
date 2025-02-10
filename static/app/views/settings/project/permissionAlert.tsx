import Access from 'sentry/components/acl/access';
import type {AlertProps} from 'sentry/components/alert';
import {Alert} from 'sentry/components/alert';
import {t} from 'sentry/locale';
import type {Scope} from 'sentry/types/core';
import type {Team} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

interface PermissionAlertProps extends Omit<AlertProps, 'type'> {
  access?: Scope[];
  project?: Project;
  team?: Team;
}

export const permissionAlertText = t(
  'These settings can only be edited by users with the organization-level owner, manager, or team-level admin roles.'
);

function PermissionAlert({
  access = ['project:write'],
  project,
  team,
  ...props
}: PermissionAlertProps) {
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
