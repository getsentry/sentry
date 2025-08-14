import {t} from 'sentry/locale';
import type {Integration} from 'sentry/types/integrations';

export const integratedOrgIdToName = (id?: string, integrations?: Integration[]) => {
  if (!id || !integrations) {
    return t('Select Integrated Org');
  }
  const result = integrations.find(item => item.id === id);
  return result?.name || t('Select Integrated Org');
};
