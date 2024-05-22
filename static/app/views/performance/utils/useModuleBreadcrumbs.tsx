import type {Crumb} from 'sentry/components/breadcrumbs';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {INSIGHTS_BASE_URL, INSIGHTS_LABEL} from 'sentry/views/performance/settings';
import {useModuleTitle} from 'sentry/views/performance/utils/useModuleTitle';
import {useModuleURL} from 'sentry/views/performance/utils/useModuleURL';
import {ModuleName} from 'sentry/views/starfish/types';

type ModuleNameStrings = `${ModuleName}`;
type RoutableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

export function useModuleBreadcrumbs(moduleName: RoutableModuleNames): Crumb[] {
  const organization = useOrganization();

  const moduleLabel = useModuleTitle(moduleName);
  const moduleTo = useModuleURL(moduleName);

  // AI Modules lives outside of Performance right now
  if (moduleName === ModuleName.AI) {
    return [
      {
        label: moduleLabel,
        to: moduleTo,
        preservePageFilters: true,
      },
    ];
  }

  return [
    {
      label: INSIGHTS_LABEL,
      to: normalizeUrl(`/organizations/${organization.slug}${INSIGHTS_BASE_URL}/`),
      preservePageFilters: true,
    },
    {
      label: moduleLabel,
      to: moduleTo,
      preservePageFilters: true,
    },
  ];
}
