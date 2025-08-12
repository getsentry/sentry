import type {Integration} from 'sentry/types/integrations';

export const integratedOrgIdToName = (id?: string, integrations?: Integration[]) => {
  if (!id || !integrations) {
    return 'No Integration';
  }
  const result = integrations.find(item => item.id === id);
  return result ? result.name : 'Unknown Integration';
};
