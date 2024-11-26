import {useMemo} from 'react';

import {DOMAIN_VIEW_MODULE_TITLES} from 'sentry/views/insights/common/utils/moduleTitles';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {MODULE_TITLES} from 'sentry/views/insights/settings';
import type {ModuleName} from 'sentry/views/insights/types';

export const useModuleTitles = (): Record<ModuleName, string> => {
  const {isInDomainView, view} = useDomainViewFilters();
  const moduleTitles = useMemo(() => {
    let titles = {...MODULE_TITLES};
    if (isInDomainView && view) {
      titles = {...MODULE_TITLES, ...DOMAIN_VIEW_MODULE_TITLES[view]};
    }
    return titles;
  }, [isInDomainView, view]);

  return moduleTitles;
};

export const useModuleTitle = (moduleName: ModuleName): string => {
  return useModuleTitles()[moduleName];
};
