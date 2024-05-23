import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import useOrganization from 'sentry/utils/useOrganization';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import {ScreensView, YAxis} from 'sentry/views/performance/mobile/screenload/screens';
import {
  MODULE_DESCRIPTION,
  MODULE_DOC_LINK,
} from 'sentry/views/performance/mobile/screenload/settings';
import usePlatformSelector from 'sentry/views/performance/mobile/usePlatformSelector';
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import Onboarding from 'sentry/views/performance/onboarding';
import {useModuleBreadcrumbs} from 'sentry/views/performance/utils/useModuleBreadcrumbs';
import {ReleaseComparisonSelector} from 'sentry/views/starfish/components/releaseSelector';

export function PageloadModule() {
  const organization = useOrganization();
  const onboardingProject = useOnboardingProject();
  const {isProjectCrossPlatform, PlatformSelector} = usePlatformSelector();

  const crumbs = useModuleBreadcrumbs('screen_load');

  return (
    <Layout.Page>
      <PageAlertProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs crumbs={crumbs} />
            <HeaderWrapper>
              <Layout.Title>
                {t('Screen Loads')}
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
              <PageFilterBar condensed>
                <ProjectPageFilter />
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
              <ReleaseComparisonSelector />
            </Container>
            <PageAlert />
            <ErrorBoundary mini>
              {onboardingProject && (
                <OnboardingContainer>
                  <Onboarding organization={organization} project={onboardingProject} />
                </OnboardingContainer>
              )}
              {!onboardingProject && (
                <ScreensView yAxes={[YAxis.TTID, YAxis.TTFD]} chartHeight={240} />
              )}
            </ErrorBoundary>
          </Layout.Main>
        </Layout.Body>
      </PageAlertProvider>
    </Layout.Page>
  );
}

function PageWithProviders() {
  return (
    <ModulePageProviders moduleName="screen_load" features="spans-first-ui">
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
