import AppStartup from 'sentry/views/performance/mobile/appStarts/screens';
import {StartTypeSelector} from 'sentry/views/performance/mobile/appStarts/screenSummary/startTypeSelector';
import {MODULE_TITLE} from 'sentry/views/performance/mobile/appStarts/settings';
import ScreensTemplate from 'sentry/views/performance/mobile/components/screensTemplate';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {ModuleName} from 'sentry/views/starfish/types';

export function InitializationModule() {
  return (
    <ScreensTemplate
      additionalSelectors={<StartTypeSelector />}
      content={<AppStartup chartHeight={200} />}
      moduleName={ModuleName.APP_START}
      title={MODULE_TITLE}
    />
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="app_start" features="spans-first-ui">
      <InitializationModule />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
