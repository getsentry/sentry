import {useMemo} from 'react';

import type {Scope} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {useOrganization} from 'sentry/utils/useOrganization';

// Mirrors the backend TempestCredentialsPermission POST/DELETE scope_map exactly.
// Access is granted if the user holds *any* of these scopes for the project
// (OR semantics, matching `has_any_project_scope`).
// Keep in sync with src/sentry/tempest/permissions.py
const TEMPEST_WRITE_ACCESS: Scope[] = [
  'org:admin',
  'org:write',
  'project:admin',
  'project:write',
];

export function useHasTempestWriteAccess(project: Project) {
  const organization = useOrganization();

  return useMemo(
    () =>
      TEMPEST_WRITE_ACCESS.some(
        scope => organization.access?.includes(scope) || project.access?.includes(scope)
      ),
    [organization, project]
  );
}
