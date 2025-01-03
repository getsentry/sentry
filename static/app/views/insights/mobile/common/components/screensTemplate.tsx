import {Fragment, type ReactNode, useCallback} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {space} from 'sentry/styles/space';
import {PageAlert, PageAlertProvider} from 'sentry/utils/performance/contexts/pageAlert';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ModulesOnboarding} from 'sentry/views/insights/common/components/modulesOnboarding';
import {ModuleBodyUpsellHook} from 'sentry/views/insights/common/components/moduleUpsellHookWrapper';
import {ReleaseComparisonSelector} from 'sentry/views/insights/common/components/releaseSelector';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {PlatformSelector} from 'sentry/views/insights/mobile/screenload/components/platformSelector';
import {MobileHeader} from 'sentry/views/insights/pages/mobile/mobilePageHeader';
import {ModuleName} from 'sentry/views/insights/types';

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
  const navigate = useNavigate();
  const location = useLocation();
  const {isProjectCrossPlatform} = useCrossPlatformProject();

  const handleProjectChange = useCallback(() => {
    navigate(
      {
        ...location,
        query: {
          ...omit(location.query, ['primaryRelease', 'secondaryRelease']),
        },
      },
      {replace: true}
    );
  }, [location, navigate]);

  return (
    <Layout.Page>
      <PageAlertProvider>
        <MobileHeader
          headerTitle={
            <Fragment>
              {title}
              <PageHeadingQuestionTooltip
                docsUrl={moduleDocLink}
                title={moduleDescription}
              />
            </Fragment>
          }
          module={ModuleName.APP_START}
          headerActions={isProjectCrossPlatform && <PlatformSelector />}
        />

        <ModuleBodyUpsellHook moduleName={moduleName}>
          <Layout.Body>
            <Layout.Main fullWidth>
              <Container>
                <ModulePageFilterBar
                  moduleName={moduleName}
                  onProjectChange={handleProjectChange}
                  extraFilters={
                    <Fragment>
                      <ReleaseComparisonSelector />
                      {additionalSelectors}
                    </Fragment>
                  }
                />
              </Container>
              <PageAlert />
              <ErrorBoundary mini>
                <ModulesOnboarding moduleName={moduleName}>{content}</ModulesOnboarding>
              </ErrorBoundary>
            </Layout.Main>
          </Layout.Body>
        </ModuleBodyUpsellHook>
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
