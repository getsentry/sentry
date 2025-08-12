import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';

export const integratedOrgIdToName = (id?: string, integrations?: Integration[]) => {
  if (!id || !integrations) {
    return t('Select integrated organization');
  }
  const result = integrations.find(item => item.id === id);
  return result?.name || t('Select integrated organization');
};
