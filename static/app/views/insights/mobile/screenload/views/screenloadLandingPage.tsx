import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {space} from 'sentry/styles/space';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import useOrganization from 'sentry/utils/useOrganization';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulePageProviders} from 'sentry/views/insights/common/components/modulePageProviders';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ReleaseComparisonSelector} from 'sentry/views/insights/common/components/releaseSelector';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import {useModuleBreadcrumbs} from 'sentry/views/insights/common/utils/useModuleBreadcrumbs';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {PlatformSelector} from 'sentry/views/insights/mobile/screenload/components/platformSelector';
import {ScreensView} from 'sentry/views/insights/mobile/screenload/components/screensView';
import {YAxis} from 'sentry/views/insights/mobile/screenload/constants';
import {
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
  MODULE_TITLE,
} from 'sentry/views/insights/mobile/screenload/settings';
import {ModuleName} from 'sentry/views/insights/types';
import Onboarding from 'sentry/views/performance/onboarding';

export function PageloadModule() {
  const organization = useOrganization();
  const onboardingProject = useOnboardingProject();
  const {isProjectCrossPlatform} = useCrossPlatformProject();

  const crumbs = useModuleBreadcrumbs('screen_load');

  return (
    <Layout.Page>
      <PageAlertProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs crumbs={crumbs} />
            <HeaderWrapper>
              <Layout.Title>
                {MODULE_TITLE}
                <PageHeadingQuestionTooltip
                  docsUrl={MODULE_DOC_LINK}
                  title={MODULE_DESCRIPTION}
                />
              </Layout.Title>
            </HeaderWrapper>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <ButtonBar gap={1}>
              {isProjectCrossPlatform && <PlatformSelector />}
              <FeedbackWidgetButton />
            </ButtonBar>
          </Layout.HeaderActions>
        </Layout.Header>

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
                    <Onboarding organization={organization} project={onboardingProject} />
                  </OnboardingContainer>
                )}
                {!onboardingProject && (
                  <ScreensView yAxes={[YAxis.TTID, YAxis.TTFD]} chartHeight={240} />
                )}
              </ModulesOnboarding>
            </ErrorBoundary>
          </Layout.Main>
        </Layout.Body>
      </PageAlertProvider>
    </Layout.Page>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders
      moduleName="screen_load"
      features="insights-initial-modules"
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

const HeaderWrapper = styled('div')`
  display: flex;
`;
