import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

export function useInsightsTitle() {
  const organization = useOrganization();

  return organization?.features?.includes('performance-insights')
    ? t('Insights')
    : t('Performance');
}
