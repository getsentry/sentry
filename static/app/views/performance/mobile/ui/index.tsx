import ScreensTemplate from 'sentry/views/performance/mobile/components/screensTemplate';
import {UIScreens} from 'sentry/views/performance/mobile/ui/screens';
import {
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
} from 'sentry/views/performance/mobile/ui/settings';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {ModuleName} from 'sentry/views/starfish/types';
import {ROUTE_NAMES} from 'sentry/views/starfish/utils/routeNames';

export function ResponsivenessModule() {
  return (
    <ScreensTemplate
      content={<UIScreens />}
      title={ROUTE_NAMES.mobileUI}
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
      features={['spans-first-ui', 'starfish-mobile-ui-module']}
    >
      <ResponsivenessModule />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
