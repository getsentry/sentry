import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import FloatingFeedbackWidget from 'sentry/components/feedback/widget/floatingFeedbackWidget';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import useOrganization from 'sentry/utils/useOrganization';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import Onboarding from 'sentry/views/performance/onboarding';
import {ReleaseComparisonSelector} from 'sentry/views/starfish/components/releaseSelector';
import {ScreensView, YAxis} from 'sentry/views/starfish/views/screens';

export default function PageloadModule() {
  const organization = useOrganization();
  const onboardingProject = useOnboardingProject();

  return (
    <SentryDocumentTitle title={t('Mobile')} orgSlug={organization.slug}>
      <Layout.Page>
        <PageErrorProvider>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title>{t('Mobile')}</Layout.Title>
            </Layout.HeaderContent>
          </Layout.Header>

          <Layout.Body>
            <FloatingFeedbackWidget />
            <Layout.Main fullWidth>
              <PageErrorAlert />
              <PageFiltersContainer>
                <Container>
                  <PageFilterBar condensed>
                    <ProjectPageFilter />
                    <EnvironmentPageFilter />
                    <DatePageFilter />
                  </PageFilterBar>
                  <ReleaseComparisonSelector />
                </Container>
                <ErrorBoundary mini>
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
                </ErrorBoundary>
              </PageFiltersContainer>
            </Layout.Main>
          </Layout.Body>
        </PageErrorProvider>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

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
