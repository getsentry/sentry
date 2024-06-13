import AppStartup from 'sentry/views/performance/mobile/appStarts/screens';
import {StartTypeSelector} from 'sentry/views/performance/mobile/appStarts/screenSummary/startTypeSelector';
import {
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  MODULE_TITLE,
} from 'sentry/views/performance/mobile/appStarts/settings';
import ScreensTemplate from 'sentry/views/performance/mobile/components/screensTemplate';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {ModuleName} from 'sentry/views/starfish/types';

export function InitializationModule() {
  return (
    <ScreensTemplate
      additionalSelectors={<StartTypeSelector />}
      content={<AppStartup chartHeight={200} />}
      moduleName={ModuleName.APP_START}
      moduleDescription={MODULE_DESCRIPTION}
      moduleDocLink={MODULE_DOC_LINK}
      title={MODULE_TITLE}
    />
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="app_start" features="insights-initial-modules">
      <InitializationModule />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
