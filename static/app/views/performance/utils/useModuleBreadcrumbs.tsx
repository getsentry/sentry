import type {Crumb} from 'sentry/components/breadcrumbs';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useInsightsTitle} from 'sentry/views/performance/utils/useInsightsTitle';
import {useInsightsURL} from 'sentry/views/performance/utils/useInsightsURL';
import {useModuleTitle} from 'sentry/views/performance/utils/useModuleTitle';
import {useModuleURL} from 'sentry/views/performance/utils/useModuleURL';
import {ModuleName} from 'sentry/views/starfish/types';

type ModuleNameStrings = `${ModuleName}`;
type RoutableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

export function useModuleBreadcrumbs(moduleName: RoutableModuleNames): Crumb[] {
  const organization = useOrganization();

  const insightsURL = useInsightsURL(moduleName);
  const insightsTitle = useInsightsTitle(moduleName);

  const moduleLabel = useModuleTitle(moduleName);
  const moduleTo = useModuleURL(moduleName);

  // If `insights` flag is present, the root crumb is "Insights". If it's absent, LLMs base crumb is nothing, and other Insights modules base breadcrumb is "Performance"
  return organization?.features?.includes('performance-insights')
    ? [
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
      ]
    : moduleName === ModuleName.AI
      ? [
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
