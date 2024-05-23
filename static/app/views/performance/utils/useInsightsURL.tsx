import useOrganization from 'sentry/utils/useOrganization';
import {ModuleName} from 'sentry/views/starfish/types';

type ModuleNameStrings = `${ModuleName}`;
type RoutableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

export function useInsightsURL(moduleName: RoutableModuleNames) {
  const builder = useInsightsURLBuilder();
  return builder(moduleName);
}

type URLBuilder = (moduleName: RoutableModuleNames) => string;

export function useInsightsURLBuilder(): URLBuilder {
  const organization = useOrganization();

  return function (moduleName: RoutableModuleNames) {
    // If `insights` flag is present, all Insights modules are routed from `/insights`. If the flag is absent, LLM is routed from `/` and other insights modules are routed of `/performance`
    return organization?.features?.includes('performance-insights')
      ? 'insights'
      : moduleName === ModuleName.AI
        ? ''
        : 'performance';
  };
}
