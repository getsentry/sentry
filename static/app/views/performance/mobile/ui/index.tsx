import ScreensTemplate from 'sentry/views/performance/mobile/components/screensTemplate';
import {UIScreens} from 'sentry/views/performance/mobile/ui/screens';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import {ROUTE_NAMES} from 'sentry/views/starfish/utils/routeNames';

export function ResponsivenessModule() {
  return <ScreensTemplate content={<UIScreens />} title={ROUTE_NAMES.mobileUI} />;
}

function PageWithProviders() {
  return (
    <ModulePageProviders
      title={ROUTE_NAMES.mobileUI}
      features={['spans-first-ui', 'starfish-mobile-ui-module']}
    >
      <ResponsivenessModule />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
