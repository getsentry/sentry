import {Fragment} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {
  DATA_TYPE,
  SUMMARY_PAGE_TITLE,
} from 'sentry/views/insights/mobile/screenRendering/settings';
import {ScreenSummaryContent} from 'sentry/views/insights/mobile/ui/views/screenSummaryPage';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {ModuleName} from 'sentry/views/insights/types';

function ScreenRenderingSummary() {
  const location = useLocation();

  const {transaction: transactionName} = location.query;
  return (
    <Fragment>
      <MobileHeader
        headerTitle={transactionName}
        module={ModuleName.SCREEN_RENDERING}
        breadcrumbs={[{label: SUMMARY_PAGE_TITLE}]}
      />
      <ModuleBodyUpsellHook moduleName={ModuleName.SCREEN_RENDERING}>
        <Layout.Body>
          <Layout.Main fullWidth>
            <ModuleLayout.Layout>
              <ModuleLayout.Full>
                <ScreenSummaryContent />
              </ModuleLayout.Full>
            </ModuleLayout.Layout>
          </Layout.Main>
        </Layout.Body>
      </ModuleBodyUpsellHook>
    </Fragment>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders
      moduleName={ModuleName.SCREEN_RENDERING}
      pageTitle={`${DATA_TYPE} ${t('Summary')}`}
    >
      <ScreenRenderingSummary />
    </ModulePageProviders>
  );
}

export default PageWithProviders;
