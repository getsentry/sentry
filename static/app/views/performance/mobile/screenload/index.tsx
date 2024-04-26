import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import ErrorBoundary from 'sentry/components/errorBoundary';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import {ScreensView, YAxis} from 'sentry/views/performance/mobile/screenload/screens';
import {PlatformSelector} from 'sentry/views/performance/mobile/screenload/screens/platformSelector';
import {isCrossPlatform} from 'sentry/views/performance/mobile/screenload/screens/utils';
import Onboarding from 'sentry/views/performance/onboarding';
import {PlatformCompatibilityChecker} from 'sentry/views/performance/platformCompatibilityChecker';
import {ReleaseComparisonSelector} from 'sentry/views/starfish/components/releaseSelector';
import {ROUTE_NAMES} from 'sentry/views/starfish/utils/routeNames';

export default function PageloadModule() {
  const organization = useOrganization();
  const onboardingProject = useOnboardingProject();
  const {selection} = usePageFilters();
  const {projects} = useProjects();

  const project = useMemo(() => {
    if (selection.projects.length !== 1) {
      return null;
    }
    return projects.find(p => p.id === String(selection.projects));
  }, [projects, selection.projects]);

  return (
    <SentryDocumentTitle title={t('Screen Loads')} orgSlug={organization.slug}>
      <Layout.Page>
        <PageAlertProvider>
          <Layout.Header>
            <Layout.HeaderContent>
              <Breadcrumbs
                crumbs={[
                  {
                    label: t('Performance'),
                    to: normalizeUrl(`/organizations/${organization.slug}/performance/`),
                    preservePageFilters: true,
                  },
                  {
                    label: ROUTE_NAMES.pageload,
                  },
                ]}
              />
              <HeaderWrapper>
                <Layout.Title>{t('Screen Loads')}</Layout.Title>
                {organization.features.includes('spans-first-ui') &&
                  project &&
                  isCrossPlatform(project) && <PlatformSelector />}
              </HeaderWrapper>
            </Layout.HeaderContent>
            <Layout.HeaderActions>
              <ButtonBar gap={1}>
                <FeedbackWidgetButton />
              </ButtonBar>
            </Layout.HeaderActions>
          </Layout.Header>

          <Layout.Body>
            <Layout.Main fullWidth>
              <PageFiltersContainer>
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
                  <PlatformCompatibilityChecker
                    compatibleSDKNames={[
                      'sentry.java.android',
                      'sentry.cocoa',
                      'sentry.javascript.react-native',
                      'sentry.dart.flutter',
                    ]}
                    docsUrl="https://docs.sentry.io/product/performance/mobile-vitals/screen-loads/#minimum-sdk-requirements"
                  >
                    {onboardingProject && (
                      <OnboardingContainer>
                        <Onboarding
                          organization={organization}
                          project={onboardingProject}
                        />
                      </OnboardingContainer>
                    )}
                    {!onboardingProject && (
                      <ScreensView
                        yAxes={[YAxis.TTID, YAxis.TTFD]}
                        chartHeight={240}
                        project={project}
                      />
                    )}
                  </PlatformCompatibilityChecker>
                </ErrorBoundary>
              </PageFiltersContainer>
            </Layout.Main>
          </Layout.Body>
        </PageAlertProvider>
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

const HeaderWrapper = styled('div')`
  display: flex;
`;
