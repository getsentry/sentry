import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {ServiceAccount} from './types';

export const NO_WRITE_ACCESS_REASON = t(
  'You need permission to manage service accounts.'
);

/**
 * Mirrors the API's checks: managing accounts needs `service_account:write`, and only
 * a role with access to all projects can grant all projects.
 */
export function useServiceAccountAccess() {
  const organization = useOrganization();
  const hasGlobalRole =
    organization.orgRoleList?.find(role => role.id === organization.orgRole)?.isGlobal ??
    false;
  return {
    canWrite: organization.access.includes('service_account:write'),
    hasGlobalRole,
  };
}

/** Why the account can't be changed here, or null when it can. */
export function useCannotManageReason(account: ServiceAccount): string | null {
  const {canWrite} = useServiceAccountAccess();
  if (account.ownerKind === 'seer_workflow_config') {
    return t('This account belongs to a Seer automation. Change it from the automation.');
  }
  if (!canWrite) {
    return NO_WRITE_ACCESS_REASON;
  }
  return null;
}
