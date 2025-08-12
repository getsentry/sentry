import type {Integration} from 'sentry/types/integrations';

const EMPTY_MESSAGE = 'Select integrated organization';

export const integratedOrgIdToName = (id?: string, integrations?: Integration[]) => {
  if (!id || !integrations) {
    return EMPTY_MESSAGE;
  }
  const result = integrations.find(item => item.id === id);
  return result ? result.name : EMPTY_MESSAGE;
};
