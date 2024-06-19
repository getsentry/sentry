import type {Crumb} from 'sentry/components/breadcrumbs';
import {useModuleTitle} from 'sentry/views/insights/common/utils/useModuleTitle';
import {useModuleURL} from 'sentry/views/insights/common/utils/useModuleURL';
import {INSIGHTS_TITLE} from 'sentry/views/insights/settings';
import type {ModuleName} from 'sentry/views/insights/types';

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
