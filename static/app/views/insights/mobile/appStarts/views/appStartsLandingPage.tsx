import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import AppStartup from 'sentry/views/insights/mobile/appStarts/components/appStartup';
import {StartTypeSelector} from 'sentry/views/insights/mobile/appStarts/components/startTypeSelector';
import {
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  MODULE_TITLE,
} from 'sentry/views/insights/mobile/appStarts/settings';
import ScreensTemplate from 'sentry/views/insights/mobile/common/components/screensTemplate';
import {ModuleName} from 'sentry/views/insights/types';

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
    <ModulePageProviders
      moduleName="app_start"
      analyticEventName="insight.page_loads.app_start"
    >
      <InitializationModule />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
