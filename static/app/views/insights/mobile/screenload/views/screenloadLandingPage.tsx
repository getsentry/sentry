import {Fragment} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {space} from 'sentry/styles/space';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import useOrganization from 'sentry/utils/useOrganization';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {ReleaseComparisonSelector} from 'sentry/views/insights/common/components/releaseSelector';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {PlatformSelector} from 'sentry/views/insights/mobile/screenload/components/platformSelector';
import {ScreensView} from 'sentry/views/insights/mobile/screenload/components/screensView';
import {YAxis} from 'sentry/views/insights/mobile/screenload/constants';
import {
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  MODULE_TITLE,
} from 'sentry/views/insights/mobile/screenload/settings';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {ModuleName} from 'sentry/views/insights/types';
import Onboarding from 'sentry/views/performance/onboarding';

export function PageloadModule() {
  const organization = useOrganization();
  const onboardingProject = useOnboardingProject();
  const {isProjectCrossPlatform} = useCrossPlatformProject();

  return (
    <Layout.Page>
      <PageAlertProvider>
        <MobileHeader
          module={ModuleName.SCREEN_LOAD}
          headerTitle={
            <Fragment>
              {MODULE_TITLE}
              <PageHeadingQuestionTooltip
                docsUrl={MODULE_DOC_LINK}
                title={MODULE_DESCRIPTION}
              />
            </Fragment>
          }
          headerActions={isProjectCrossPlatform && <PlatformSelector />}
        />

        <ModuleBodyUpsellHook moduleName={ModuleName.SCREEN_LOAD}>
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
                <ModulesOnboarding moduleName={ModuleName.SCREEN_LOAD}>
                  {onboardingProject && (
                    <OnboardingContainer>
                      <Onboarding
                        organization={organization}
                        project={onboardingProject}
                      />
                    </OnboardingContainer>
                  )}
                  {!onboardingProject && (
                    <ScreensView yAxes={[YAxis.TTID, YAxis.TTFD]} chartHeight={240} />
                  )}
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
      analyticEventName="insight.page_loads.screen_load"
    >
      <PageloadModule />
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

const OnboardingContainer = styled('div')`
  margin-top: ${space(2)};
`;
