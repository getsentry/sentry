import {useMemo} from 'react';

import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {hasMCPInsightsFeature} from 'sentry/views/insights/agentMonitoring/utils/features';
import {DOMAIN_VIEW_MODULE_TITLES} from 'sentry/views/insights/common/utils/moduleTitles';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {MODULE_TITLES} from 'sentry/views/insights/settings';
import {ModuleName} from 'sentry/views/insights/types';

export const useModuleTitles = (): Record<ModuleName, string> => {
  const {isInDomainView, view} = useDomainViewFilters();
  const organization = useOrganization();
  const moduleTitles = useMemo(() => {
    let titles = {...MODULE_TITLES};
    if (isInDomainView && view) {
      titles = {...MODULE_TITLES, ...DOMAIN_VIEW_MODULE_TITLES[view]};
    }
    // TODO: Rename the respective constant when removing the feature flag
    if (hasMCPInsightsFeature(organization)) {
      titles = {...titles, [ModuleName.AGENTS]: t('Agents')};
    }
    return titles;
  }, [isInDomainView, organization, view]);

  return moduleTitles;
};

export const useModuleTitle = (moduleName: ModuleName): string => {
  return useModuleTitles()[moduleName];
};
