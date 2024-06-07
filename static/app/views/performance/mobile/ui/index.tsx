import ScreensTemplate from 'sentry/views/performance/mobile/components/screensTemplate';
import {UIScreens} from 'sentry/views/performance/mobile/ui/screens';
import {
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  MODULE_TITLE,
} from 'sentry/views/performance/mobile/ui/settings';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {ModuleName} from 'sentry/views/starfish/types';

export function ResponsivenessModule() {
  return (
    <ScreensTemplate
      content={<UIScreens />}
      title={MODULE_TITLE}
      moduleName={ModuleName.MOBILE_UI}
      moduleDescription={MODULE_DESCRIPTION}
      moduleDocLink={MODULE_DOC_LINK}
    />
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders
      moduleName="mobile-ui"
      features={['insights-addon-modules', 'starfish-mobile-ui-module']}
    >
      <ResponsivenessModule />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
