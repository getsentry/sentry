import ScreensTemplate from 'sentry/views/performance/mobile/components/screensTemplate';
import {UIScreens} from 'sentry/views/performance/mobile/ui/screens';
import {MODULE_TITLE} from 'sentry/views/performance/mobile/ui/settings';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {ModuleName} from 'sentry/views/starfish/types';

export function ResponsivenessModule() {
  return (
    <ScreensTemplate
      content={<UIScreens />}
      title={MODULE_TITLE}
      moduleName={ModuleName.MOBILE_UI}
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
