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
  const organization = useOrganization({allowNull: true}); // Some parts of the app, like the main sidebar, render even if the organization isn't available (during loading, or at all).

  if (!organization) {
    // If there isn't an organization, items that link to modules won't be visible, so this is a fallback just-in-case, and isn't trying too hard to be useful
    return () => '';
  }

  return function (moduleName: RoutableModuleNames) {
    // If `insights` flag is present, all Insights modules are routed from `/insights`. If the flag is absent, LLM is routed from `/` and other insights modules are routed of `/performance`
    return organization?.features?.includes('performance-insights')
      ? 'insights'
      : moduleName === ModuleName.AI
        ? ''
        : 'performance';
  };
}
