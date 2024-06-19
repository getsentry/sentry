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
import {space} from 'sentry/styles/space';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import useOrganization from 'sentry/utils/useOrganization';
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
import {ModulePageProviders} from 'sentry/views/performance/modulePageProviders';
import Onboarding from 'sentry/views/performance/onboarding';
import {useModuleBreadcrumbs} from 'sentry/views/performance/utils/useModuleBreadcrumbs';

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
    <ModulePageProviders moduleName="screen_load" features="insights-initial-modules">
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
