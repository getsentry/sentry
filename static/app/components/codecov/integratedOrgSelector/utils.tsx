import type {Integration} from 'sentry/types/integrations';

export const integratedOrgIdToName = (id?: string, integrations?: Integration[]) => {
  if (!id || !integrations) {
    return '';
  }
  const result = integrations.find(item => item.id === id);
  return result ? result.name : '';
};
