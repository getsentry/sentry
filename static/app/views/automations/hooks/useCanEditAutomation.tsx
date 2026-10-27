import type {ReactNode} from 'react';
import {useMemo} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';

import {Link} from '@sentry/scraps/link';

import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {
  canEditAutomationProjectScope,
  hasAllProjectsAutomationWriteAccess,
  hasAutomationWriteAccess,
  hasOrganizationAutomationWriteAccess,
  type AutomationProjectScope,
} from 'sentry/views/automations/utils/permissions';

function workflowProjectScopeApiOptions({
  automationId,
  enabled,
  organization,
}: {
  automationId: string;
  enabled: boolean;
  organization: Organization;
}) {
  return apiOptions.as<AutomationProjectScope>()(
    '/organizations/$organizationIdOrSlug/workflows/$workflowId/project-scope/',
    {
      path: enabled
        ? {
            organizationIdOrSlug: organization.slug,
            workflowId: automationId,
          }
        : skipToken,
      staleTime: 0,
    }
  );
}

function useAutomationAccess() {
  const organization = useOrganization();
  const {projects} = useProjects();
  const canEditOrganization = hasOrganizationAutomationWriteAccess(organization);
  const canEditAllProjects = hasAllProjectsAutomationWriteAccess(organization);
  const writableProjectIds = useMemo(
    () =>
      new Set(
        projects
          .filter(project => hasAutomationWriteAccess({organization, project}))
          .map(project => project.id)
      ),
    [organization, projects]
  );

  return {canEditAllProjects, canEditOrganization, organization, writableProjectIds};
}

export function useAutomationEditPermission(automationId: string): {
  canEdit: boolean;
  disabledReason: ReactNode;
  isPending: boolean;
} {
  const {canEditAllProjects, canEditOrganization, organization, writableProjectIds} =
    useAutomationAccess();
  const shouldFetchProjectScope =
    !canEditAllProjects && (canEditOrganization || writableProjectIds.size > 0);
  const {
    data: projectScope,
    isError,
    isPending,
  } = useQuery(
    workflowProjectScopeApiOptions({
      organization,
      automationId,
      enabled: shouldFetchProjectScope,
    })
  );

  if (canEditAllProjects) {
    return {canEdit: true, disabledReason: undefined, isPending: false};
  }

  if (shouldFetchProjectScope && isPending) {
    return {canEdit: false, disabledReason: undefined, isPending: true};
  }

  if (isError) {
    return {
      canEdit: false,
      disabledReason: t('Could not verify your edit permissions. Refresh and try again.'),
      isPending: false,
    };
  }

  if (projectScope?.includesAllProjects) {
    return {
      canEdit: false,
      disabledReason: getNoAllProjectsWritePermissionTooltip(),
      isPending: false,
    };
  }

  if (canEditOrganization) {
    return projectScope
      ? {canEdit: true, disabledReason: undefined, isPending: false}
      : {
          canEdit: false,
          disabledReason: getNoAlertWritePermissionTooltip(),
          isPending: false,
        };
  }

  const canEdit = canEditAutomationProjectScope(projectScope, writableProjectIds);
  return {
    canEdit,
    disabledReason: canEdit ? undefined : getNoAlertWritePermissionTooltip(),
    isPending: false,
  };
}

export function useCanCreateAutomation(): boolean {
  const {canEditOrganization, writableProjectIds} = useAutomationAccess();
  return canEditOrganization || writableProjectIds.size > 0;
}

function AlertsMemberWriteSettingsLink({children}: {children?: ReactNode}) {
  const organization = useOrganization();

  return (
    <Link
      to={{
        hash: 'alertsMemberWrite',
        pathname: `/settings/${organization.slug}/`,
      }}
    >
      {children}
    </Link>
  );
}

export function getNoAlertWritePermissionTooltip() {
  return tct(
    'You do not have permission to create or edit alerts. Ask your organization owner or manager to [settingsLink:enable alert access] for you.',
    {settingsLink: <AlertsMemberWriteSettingsLink />}
  );
}

export function getNoAllProjectsWritePermissionTooltip() {
  return t('Only organization owners and managers can create/modify all-project alerts.');
}
