import type {Location} from 'history';

import type {Integration} from 'sentry/types/integrations';

export const integratedOrgIdToName = (id?: string, integrations?: Integration[]) => {
  if (!id || !integrations) {
    return null;
  }
  const result = integrations.find(item => item.id === id);
  return result?.name || null;
};

export const integratedOrgIdToDomainName = (
  id?: string,
  integrations?: Integration[]
) => {
  if (!id || !integrations) {
    return null;
  }
  const result = integrations.find(item => item.id === id);
  return result?.domainName || null;
};

export const getPreventParamsString = (location: Location) => {
  const preventParams: Record<string, string | string[]> = {};

  if (location.query?.integratedOrgId) {
    preventParams.integratedOrgId = location.query.integratedOrgId;
  }
  if (location.query?.repository) {
    preventParams.repository = location.query.repository;
  }
  if (location.query?.branch) {
    preventParams.branch = location.query.branch;
  }
  if (location.query?.preventPeriod) {
    preventParams.preventPeriod = location.query.preventPeriod;
  }

  return new URLSearchParams(
    Object.fromEntries(
      Object.entries(preventParams)
        .map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
        .filter(([, value]) => Boolean(value))
    )
  ).toString();
};
