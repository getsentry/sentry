import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';

import {getActiveGuardrails, getBundle} from './serviceAccountData';
import type {ServiceAccount} from './types';

/** e.g. "CI · guardrails on" */
export function describePermissions(account: ServiceAccount) {
  const bundle = getBundle(account.bundleId);
  const active = getActiveGuardrails(bundle, account.guardrails).length;
  if (bundle.dataAccess === null) {
    return bundle.name;
  }
  return t(
    '%s · %s',
    bundle.name,
    active === 0 ? t('guardrails off') : t('guardrails on')
  );
}

export function getAccountProjects(account: ServiceAccount, projects: Project[]) {
  return account.allProjects
    ? projects
    : projects.filter(project => account.projectIds.includes(project.id));
}
