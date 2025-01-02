import {useLocation} from 'sentry/utils/useLocation';
import {MODULE_BASE_URLS} from 'sentry/views/insights/common/utils/useModuleURL';
import {INSIGHTS_BASE_URL} from 'sentry/views/insights/settings';
import type {ModuleName} from 'sentry/views/insights/types';

export function useModuleNameFromUrl(): ModuleName | null {
  const {pathname} = useLocation();
  // Reverse MODULE_BASE_URLS
  const urlToModuleNameMap: Record<string, ModuleName> = Object.fromEntries(
    Object.entries(MODULE_BASE_URLS)
      .map(([key, value]) => [value, key])
      .filter(([key]) => Boolean(key))
  );
  const moduleKey = Object.keys(urlToModuleNameMap).find(key => {
    return pathname.startsWith(`/${INSIGHTS_BASE_URL}/${key}`);
  });

  if (moduleKey) {
    return urlToModuleNameMap[moduleKey]!;
  }

  return null;
}
