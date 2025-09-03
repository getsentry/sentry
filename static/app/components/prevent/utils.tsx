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
