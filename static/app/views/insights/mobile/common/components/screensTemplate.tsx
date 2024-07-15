import {Fragment, type ReactNode, useCallback} from 'react';
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
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {space} from 'sentry/styles/space';
import {browserHistory} from 'sentry/utils/browserHistory';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ReleaseComparisonSelector} from 'sentry/views/insights/common/components/releaseSelector';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import {useModuleBreadcrumbs} from 'sentry/views/insights/common/utils/useModuleBreadcrumbs';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {PlatformSelector} from 'sentry/views/insights/mobile/screenload/components/platformSelector';
import type {ModuleName} from 'sentry/views/insights/types';

type ScreensTemplateProps = {
  content: ReactNode;
  moduleDescription: string;
  moduleDocLink: string;
  moduleName: ModuleName.MOBILE_UI | ModuleName.APP_START;
  title: string;
  additionalSelectors?: ReactNode;
};

export default function ScreensTemplate({
  moduleName,
  moduleDocLink,
  moduleDescription,
  title,
  additionalSelectors,
  content,
}: ScreensTemplateProps) {
  const location = useLocation();
  const {isProjectCrossPlatform} = useCrossPlatformProject();
  const hasModuleData = useHasFirstSpan(moduleName);

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
            <Layout.Title>
              {title}
              <PageHeadingQuestionTooltip
                docsUrl={moduleDocLink}
                title={moduleDescription}
              />
            </Layout.Title>
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
                <ProjectPageFilter onChange={handleProjectChange} />
                <EnvironmentPageFilter />
                <DatePageFilter />
              </PageFilterBar>
              {hasModuleData && (
                <Fragment>
                  <ReleaseComparisonSelector />
                  {additionalSelectors}
                </Fragment>
              )}
            </Container>
            <PageAlert />
            <ErrorBoundary mini>
              <ModulesOnboarding moduleName={moduleName}>{content}</ModulesOnboarding>
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
