import type {Crumb} from 'sentry/components/breadcrumbs';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useInsightsTitle} from 'sentry/views/performance/utils/useInsightsTitle';
import {useInsightsURL} from 'sentry/views/performance/utils/useInsightsURL';
import {useModuleTitle} from 'sentry/views/performance/utils/useModuleTitle';
import {useModuleURL} from 'sentry/views/performance/utils/useModuleURL';
import type {ModuleName} from 'sentry/views/starfish/types';

type ModuleNameStrings = `${ModuleName}`;
type RoutableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

export function useModuleBreadcrumbs(moduleName: RoutableModuleNames): Crumb[] {
  const organization = useOrganization();

  const insightsURL = useInsightsURL();
  const insightsTitle = useInsightsTitle();

  const moduleLabel = useModuleTitle(moduleName);
  const moduleTo = useModuleURL(moduleName);

  return organization?.features?.includes('performance-insights')
    ? [
        {
          label: insightsTitle,
          to: undefined, // There is no page at `/insights/` so there is nothing to link to
          preservePageFilters: true,
        },
        {
          label: moduleLabel,
          to: moduleTo,
          preservePageFilters: true,
        },
      ]
    : [
        {
          label: insightsTitle,
          to: normalizeUrl(`/organizations/${organization.slug}/${insightsURL}/`),
          preservePageFilters: true,
        },
        {
          label: moduleLabel,
          to: moduleTo,
          preservePageFilters: true,
        },
      ];
}
