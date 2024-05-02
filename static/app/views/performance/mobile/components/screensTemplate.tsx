import {type ReactNode, useCallback} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

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
import {browserHistory} from 'sentry/utils/browserHistory';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import Onboarding from 'sentry/views/performance/onboarding';
import {PlatformCompatibilityChecker} from 'sentry/views/performance/platformCompatibilityChecker';
import {ReleaseComparisonSelector} from 'sentry/views/starfish/components/releaseSelector';

type ScreensTemplateProps = {
  compatibilityProps: {
    compatibleSDKNames: string[];
    docsUrl: string;
  };
  content: ReactNode;
  title: string;
  additionalSelectors?: ReactNode;
};

export default function ScreensTemplate({
  title,
  additionalSelectors,
  compatibilityProps,
  content,
}: ScreensTemplateProps) {
  const organization = useOrganization();
  const onboardingProject = useOnboardingProject();
  const location = useLocation();

  const handleProjectChange = useCallback(() => {
    browserHistory.replace({
      ...location,
      query: {
        ...omit(location.query, ['primaryRelease', 'secondaryRelease']),
      },
    });
  }, [location]);

  return (
    <SentryDocumentTitle title={title} orgSlug={organization.slug}>
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
                    label: title,
                  },
                ]}
              />
              <Layout.Title>{title}</Layout.Title>
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
                    <ProjectPageFilter onChange={handleProjectChange} />
                    <EnvironmentPageFilter />
                    <DatePageFilter />
                  </PageFilterBar>
                  <ReleaseComparisonSelector />
                  {additionalSelectors}
                </Container>
              </PageFiltersContainer>
              <PageAlert />
              <ErrorBoundary mini>
                <PlatformCompatibilityChecker {...compatibilityProps}>
                  {onboardingProject && (
                    <Onboarding organization={organization} project={onboardingProject} />
                  )}
                  {!onboardingProject && content}
                </PlatformCompatibilityChecker>
              </ErrorBoundary>
            </Layout.Main>
          </Layout.Body>
        </PageAlertProvider>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

const Container = styled('div')`
  display: flex;
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  flex-wrap: wrap;
`;
