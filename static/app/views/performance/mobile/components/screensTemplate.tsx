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
import {ProjectPageFilter} from 'sentry/components/organizations/projectPageFilter';
import {space} from 'sentry/styles/space';
import {browserHistory} from 'sentry/utils/browserHistory';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import Onboarding from 'sentry/views/performance/onboarding';
import {useModuleBreadcrumbs} from 'sentry/views/performance/utils/useModuleBreadcrumbs';
import {ReleaseComparisonSelector} from 'sentry/views/starfish/components/releaseSelector';
import type {ModuleName} from 'sentry/views/starfish/types';

type ScreensTemplateProps = {
  content: ReactNode;
  moduleName: ModuleName.MOBILE_UI | ModuleName.APP_START;
  title: string;
  additionalSelectors?: ReactNode;
};

export default function ScreensTemplate({
  moduleName,
  title,
  additionalSelectors,
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

  const crumbs = useModuleBreadcrumbs(moduleName);

  return (
    <Layout.Page>
      <PageAlertProvider>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs crumbs={crumbs} />
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
            <Container>
              <PageFilterBar condensed>
                <ProjectPageFilter onChange={handleProjectChange} />
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
              <ReleaseComparisonSelector />
              {additionalSelectors}
            </Container>
            <PageAlert />
            <ErrorBoundary mini>
              {onboardingProject && (
                <Onboarding organization={organization} project={onboardingProject} />
              )}
              {!onboardingProject && content}
            </ErrorBoundary>
          </Layout.Main>
        </Layout.Body>
      </PageAlertProvider>
    </Layout.Page>
  );
}

const Container = styled('div')`
  display: flex;
  gap: ${space(2)};
  margin-bottom: ${space(2)};
  flex-wrap: wrap;
`;
