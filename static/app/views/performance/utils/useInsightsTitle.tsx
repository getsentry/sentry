import {INSIGHTS_LABEL} from 'sentry/views/performance/settings';
import {ModuleName} from 'sentry/views/starfish/types';

type ModuleNameStrings = `${ModuleName}`;
type TitleableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

export function useInsightsTitle(moduleName: TitleableModuleNames) {
  if (moduleName === ModuleName.AI) {
    // AI doesn't live under Performance
    return undefined;
  }

  return INSIGHTS_LABEL;
}
