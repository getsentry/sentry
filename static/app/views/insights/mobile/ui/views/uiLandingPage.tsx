import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import ScreensTemplate from 'sentry/views/insights/mobile/common/components/screensTemplate';
import {UIScreens} from 'sentry/views/insights/mobile/ui/components/uiScreens';
import {
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  MODULE_TITLE,
} from 'sentry/views/insights/mobile/ui/settings';
import {ModuleName} from 'sentry/views/insights/types';

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
    <ModulePageProviders moduleName="mobile-ui">
      <ResponsivenessModule />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
