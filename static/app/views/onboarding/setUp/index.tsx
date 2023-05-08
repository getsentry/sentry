import {Fragment, useCallback, useEffect, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {loadDocs} from 'sentry/actionCreators/projects';
import {Footer} from 'sentry/components/onboarding/footer';
import {FooterWithViewSampleErrorButton} from 'sentry/components/onboarding/footerWithViewSampleErrorButton';
import {PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {platformToIntegrationMap} from 'sentry/utils/integrationUtil';
import useApi from 'sentry/utils/useApi';
import {useExperiment} from 'sentry/utils/useExperiment';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import SetupIntroduction from 'sentry/views/onboarding/components/setupIntroduction';
import {SdkLoader} from 'sentry/views/onboarding/setUp/sdkLoader';

import FirstEventFooter from '../components/firstEventFooter';
import IntegrationSetup from '../integrationSetup';
import {StepProps} from '../types';

import {SdkDoc} from './sdkDoc';
import {SdkDocWithProductSelection} from './sdkDocWithProductSelection';

export type PlatformDoc = {html: string; link: string};

export function Setup({
  route,
  router,
  location,
  recentCreatedProject: project,
}: StepProps) {
  const api = useApi();
  const organization = useOrganization();

  const {
    logExperiment: newFooterLogExperiment,
    experimentAssignment: newFooterAssignment,
  } = useExperiment('OnboardingNewFooterExperiment', {
    logExperimentOnMount: false,
  });

  const heartbeatFooter = !!organization?.features.includes(
    'onboarding-heartbeat-footer'
  );

  // SDK instrumentation
  const [hasError, setHasError] = useState(false);
  const [platformDocs, setPlatformDocs] = useState<PlatformDoc | null>(null);
  const [loadedPlatform, setLoadedPlatform] = useState<PlatformKey | null>(null);

  const currentPlatform = loadedPlatform ?? project?.platform ?? 'other';
  const [showLoaderOnboarding, setShowLoaderOnboarding] = useState(
    currentPlatform === 'javascript'
  );

  const integrationSlug = project?.platform && platformToIntegrationMap[project.platform];
  const [integrationUseManualSetup, setIntegrationUseManualSetup] = useState(false);

  const showIntegrationOnboarding = integrationSlug && !integrationUseManualSetup;
  const showDocsWithProductSelection =
    currentPlatform.match('^javascript-([A-Za-z]+)$') ??
    (showLoaderOnboarding === false && currentPlatform === 'javascript');

  const hideLoaderOnboarding = useCallback(() => {
    setShowLoaderOnboarding(false);

    if (!project?.id) {
      return;
    }

    trackAnalytics('onboarding.js_loader_npm_docs_shown', {
      organization,
      platform: currentPlatform,
      project_id: project?.id,
    });
  }, [organization, currentPlatform, project?.id]);

  const fetchData = useCallback(async () => {
    // TODO: add better error handling logic
    if (!project?.platform) {
      return;
    }

    // this will be fetched in the DocWithProductSelection component
    if (showDocsWithProductSelection) {
      return;
    }

    // Show loader setup for base javascript platform
    if (showLoaderOnboarding) {
      return;
    }

    if (showIntegrationOnboarding) {
      setLoadedPlatform(project.platform);
      setPlatformDocs(null);
      setHasError(false);
      return;
    }

    try {
      const loadedDocs = await loadDocs({
        api,
        orgSlug: organization.slug,
        projectSlug: project.slug,
        platform: project.platform as PlatformKey,
      });
      setPlatformDocs(loadedDocs);
      setLoadedPlatform(project.platform);
      setHasError(false);
    } catch (error) {
      setHasError(error);
      throw error;
    }
  }, [
    project?.slug,
    project?.platform,
    api,
    organization.slug,
    showDocsWithProductSelection,
    showIntegrationOnboarding,
    showLoaderOnboarding,
  ]);

  useEffect(() => {
    // if project not found, redirect to platform selection
    if (!project) {
      router.replace(normalizeUrl(`/onboarding/${organization.slug}/select-platform/`));
    }
  }, [project, router, organization.slug]);

  useEffect(() => {
    fetchData();
  }, [fetchData, location.query.product, project?.platform]);

  // log experiment on mount if feature enabled
  useEffect(() => {
    if (heartbeatFooter) {
      newFooterLogExperiment();
    }
  }, [newFooterLogExperiment, heartbeatFooter]);

  if (!project) {
    return null;
  }

  return (
    <Fragment>
      <Wrapper>
        <MainContent>
          {showIntegrationOnboarding ? (
            <IntegrationSetup
              integrationSlug={integrationSlug}
              project={project}
              onClickManualSetup={() => {
                setIntegrationUseManualSetup(true);
              }}
            />
          ) : showDocsWithProductSelection ? (
            <SdkDocWithProductSelection
              organization={organization}
              projectSlug={project.slug}
              location={location}
              currentPlatform={currentPlatform}
              newOrg
            />
          ) : showLoaderOnboarding ? (
            <Fragment>
              <SetupIntroduction
                stepHeaderText={t(
                  'Configure %s SDK',
                  platforms.find(p => p.id === currentPlatform)?.name ?? ''
                )}
                platform={currentPlatform}
              />
              <SdkLoader
                organization={organization}
                project={project}
                location={location}
                platform={loadedPlatform}
                close={hideLoaderOnboarding}
              />
            </Fragment>
          ) : (
            <SdkDoc
              platform={loadedPlatform}
              project={project}
              hasError={hasError}
              platformDocs={platformDocs}
              onRetry={fetchData}
              organization={organization}
            />
          )}
        </MainContent>
      </Wrapper>

      {heartbeatFooter ? (
        newFooterAssignment === 'variant2' ? (
          <FooterWithViewSampleErrorButton
            projectSlug={project.slug}
            projectId={project.id}
            route={route}
            router={router}
            location={location}
            newOrg
          />
        ) : newFooterAssignment === 'variant1' ? (
          <Footer
            projectSlug={project.slug}
            projectId={project.id}
            route={route}
            router={router}
            location={location}
            newOrg
          />
        ) : (
          <FirstEventFooter
            project={project}
            organization={organization}
            isLast
            onClickSetupLater={() => {
              const orgIssuesURL = `/organizations/${organization.slug}/issues/?project=${project.id}&referrer=onboarding-setup-docs`;
              trackAnalytics('growth.onboarding_clicked_setup_platform_later', {
                organization,
                platform: currentPlatform,
                project_id: project.id,
              });
              browserHistory.push(orgIssuesURL);
            }}
          />
        )
      ) : (
        <FirstEventFooter
          project={project}
          organization={organization}
          isLast
          onClickSetupLater={() => {
            const orgIssuesURL = `/organizations/${organization.slug}/issues/?project=${project.id}&referrer=onboarding-setup-docs`;
            trackAnalytics('growth.onboarding_clicked_setup_platform_later', {
              organization,
              platform: currentPlatform,
              project_id: project.id,
            });
            browserHistory.push(orgIssuesURL);
          }}
        />
      )}
    </Fragment>
  );
}

const AnimatedContentWrapper = styled(motion.div)`
  overflow: hidden;
`;

AnimatedContentWrapper.defaultProps = {
  initial: {
    height: 0,
  },
  animate: {
    height: 'auto',
  },
  exit: {
    height: 0,
  },
};

export const DocsWrapper = styled(motion.div)``;

DocsWrapper.defaultProps = {
  initial: {opacity: 0, y: 40},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0},
};

const Wrapper = styled('div')`
  display: flex;
  flex-direction: row;
  margin: ${space(2)};
  justify-content: center;
`;

const MainContent = styled('div')`
  max-width: 850px;
  min-width: 0;
  flex-grow: 1;
`;
