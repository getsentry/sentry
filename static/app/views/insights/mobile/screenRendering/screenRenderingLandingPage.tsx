import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {space} from 'sentry/styles/space';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {ReleaseComparisonSelector} from 'sentry/views/insights/common/components/releaseSelector';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {PlatformSelector} from 'sentry/views/insights/mobile/screenload/components/platformSelector';
import {ScreenRenderingContent} from 'sentry/views/insights/mobile/screenRendering/screenRenderingContent';
import {MODULE_TITLE} from 'sentry/views/insights/mobile/screenRendering/settings';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {ModuleName} from 'sentry/views/insights/types';

export function ScreenRenderingModule() {
  const {isProjectCrossPlatform} = useCrossPlatformProject();

  return (
    <Layout.Page>
      <PageAlertProvider>
        <MobileHeader
          module={ModuleName.SCREEN_RENDERING}
          headerTitle={MODULE_TITLE}
          headerActions={isProjectCrossPlatform && <PlatformSelector />}
        />

        <ModuleBodyUpsellHook moduleName={ModuleName.SCREEN_RENDERING}>
          <Layout.Body>
            <Layout.Main fullWidth>
              <Container>
                <ModulePageFilterBar
                  moduleName={ModuleName.SCREEN_LOAD}
                  extraFilters={<ReleaseComparisonSelector />}
                />
              </Container>
              <PageAlert />
              <ErrorBoundary mini>
                <ModulesOnboarding moduleName={ModuleName.SCREEN_RENDERING}>
                  <ScreenRenderingContent />
                </ModulesOnboarding>
              </ErrorBoundary>
            </Layout.Main>
          </Layout.Body>
        </ModuleBodyUpsellHook>
      </PageAlertProvider>
    </Layout.Page>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders
      moduleName="screen_load"
      analyticEventName="insight.page_loads.screen_rendering"
    >
      <ScreenRenderingModule />
    </ModulePageProviders>
  );
}

export default PageWithProviders;

const Container = styled('div')`
  display: grid;
  grid-template-rows: auto auto auto;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-rows: auto;
    grid-template-columns: auto 1fr auto;
  }
`;
