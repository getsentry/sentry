import type {Crumb} from 'sentry/components/breadcrumbs';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {INSIGHTS_TITLE, MODULE_TITLES} from 'sentry/views/insights/settings';
import type {ModuleName} from 'sentry/views/insights/types';

type ModuleNameStrings = `${ModuleName}`;
type RoutableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

export function useModuleBreadcrumbs(moduleName: RoutableModuleNames): Crumb[] {
  const moduleTitle = MODULE_TITLES[moduleName];
  const moduleTo = useModuleURL(moduleName);

  return [
    {
      label: INSIGHTS_TITLE,
      to: undefined, // There is no page at `/insights/` so there is nothing to link to
      preservePageFilters: true,
    },
    {
      label: moduleTitle,
      to: moduleTo,
      preservePageFilters: true,
    },
  ];
}
