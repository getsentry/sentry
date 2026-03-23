import {t} from 'sentry/locale';

export const DSN_PATTERN =
  /^https?:\/\/([a-f0-9]{32})(:[a-f0-9]{32})?@[^/]+\/(?:[^/]+\/)*\d+$/;

export interface DsnLookupResponse {
  keyId: string;
  keyLabel: string;
  organizationSlug: string;
  projectId: string;
  projectName: string;
  projectPlatform: string | null;
  projectSlug: string;
}

interface DsnNavTarget {
  description: string;
  label: string;
  to: string;
}

export function getDsnNavTargets(data: DsnLookupResponse): DsnNavTarget[] {
  const {organizationSlug, projectSlug, projectId, projectName} = data;
  return [
    {
      label: t('Issues for %s', projectName),
      description: t('View issues'),
      to: `/organizations/${organizationSlug}/issues/?project=${projectId}`,
    },
    {
      label: t('%s Settings', projectName),
      description: t('Project settings'),
      to: `/settings/${organizationSlug}/projects/${projectSlug}/`,
    },
    {
      label: t('Client Keys (DSN) for %s', projectName),
      description: t('Manage DSN keys'),
      to: `/settings/${organizationSlug}/projects/${projectSlug}/keys/`,
    },
  ];
}
