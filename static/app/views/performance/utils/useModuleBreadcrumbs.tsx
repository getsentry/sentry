import type {Crumb} from 'sentry/components/breadcrumbs';
import type {ModuleName} from 'sentry/views/insights/types';
import {INSIGHTS_TITLE} from 'sentry/views/performance/settings';
import {useModuleTitle} from 'sentry/views/performance/utils/useModuleTitle';
import {useModuleURL} from 'sentry/views/performance/utils/useModuleURL';

type ModuleNameStrings = `${ModuleName}`;
type RoutableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

export function useModuleBreadcrumbs(moduleName: RoutableModuleNames): Crumb[] {
  const moduleLabel = useModuleTitle(moduleName);
  const moduleTo = useModuleURL(moduleName);

  return [
    {
      label: INSIGHTS_TITLE,
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
