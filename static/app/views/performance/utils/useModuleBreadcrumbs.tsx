import type {Crumb} from 'sentry/components/breadcrumbs';
import {useInsightsTitle} from 'sentry/views/performance/utils/useInsightsTitle';
import {useModuleTitle} from 'sentry/views/performance/utils/useModuleTitle';
import {useModuleURL} from 'sentry/views/performance/utils/useModuleURL';
import type {ModuleName} from 'sentry/views/starfish/types';

type ModuleNameStrings = `${ModuleName}`;
type RoutableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

export function useModuleBreadcrumbs(moduleName: RoutableModuleNames): Crumb[] {
  const insightsTitle = useInsightsTitle();

  const moduleLabel = useModuleTitle(moduleName);
  const moduleTo = useModuleURL(moduleName);

  return [
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
  ];
}
