import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {ModuleName} from 'sentry/views/starfish/types';

type ModuleNameStrings = `${ModuleName}`;
type TitleableModuleNames = Exclude<ModuleNameStrings, '' | 'other'>;

export function useInsightsTitle(moduleName: TitleableModuleNames) {
  const organization = useOrganization();

  // If `insights` flag is present, the top-most title is "Insights". If it's absent, for LLM the topmost title is missing, and for other Insights modules it's "Performance"
  return organization?.features?.includes('performance-insights')
    ? t('Insights')
    : moduleName === ModuleName.AI
      ? ''
      : t('Performance');
}
