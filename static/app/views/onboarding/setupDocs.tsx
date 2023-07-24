import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {loadDocs} from 'sentry/actionCreators/projects';
import {Alert} from 'sentry/components/alert';
import LoadingError from 'sentry/components/loadingError';
import {DocumentationWrapper} from 'sentry/components/onboarding/documentationWrapper';
import {Footer} from 'sentry/components/onboarding/footer';
import {FooterWithViewSampleErrorButton} from 'sentry/components/onboarding/footerWithViewSampleErrorButton';
import {
  migratedDocs,
  SdkDocumentation,
} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {MissingExampleWarning} from 'sentry/components/onboarding/missingExampleWarning';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {OnboardingPlatformDoc} from 'sentry/types/onboarding';
import {trackAnalytics} from 'sentry/utils/analytics';
import getDynamicText from 'sentry/utils/getDynamicText';
import {platformToIntegrationMap} from 'sentry/utils/integrationUtil';
import useApi from 'sentry/utils/useApi';
import {useExperiment} from 'sentry/utils/useExperiment';
import useOrganization from 'sentry/utils/useOrganization';
import SetupIntroduction from 'sentry/views/onboarding/components/setupIntroduction';
import {SetupDocsLoader} from 'sentry/views/onboarding/setupDocsLoader';

import FirstEventFooter from './components/firstEventFooter';
import IntegrationSetup from './integrationSetup';
import {StepProps} from './types';

function ProjectDocs(props: {
  hasError: boolean;
  onRetry: () => void;
  organization: Organization;
  platform: PlatformKey | null;
  platformDocs: OnboardingPlatformDoc | null;
  project: Project;
}) {
  const currentPlatform = props.platform ?? props.project?.platform ?? 'other';

  return (
    <Fragment>
      <SetupIntroduction
        stepHeaderText={t(
          'Configure %s SDK',
          platforms.find(p => p.id === currentPlatform)?.name ?? ''
        )}
        platform={currentPlatform}
      />
      {getDynamicText({
        value: !props.hasError ? (
          props.platformDocs !== null && (
            <DocsWrapper key={props.platformDocs.html}>
              <DocumentationWrapper
                dangerouslySetInnerHTML={{__html: props.platformDocs.html}}
              />
              <MissingExampleWarning
                platform={props.platform}
                platformDocs={props.platformDocs}
              />
            </DocsWrapper>
          )
        ) : (
          <LoadingError
            message={t(
              'Failed to load documentation for the %s platform.',
              props.project?.platform
            )}
            onRetry={props.onRetry}
          />
        ),
        fixed: (
          <Alert type="warning">
            Platform documentation is not rendered in for tests in CI
          </Alert>
        ),
      })}
    </Fragment>
  );
}

function SetupDocs({route, router, location, recentCreatedProject: project}: StepProps) {
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

  const products = useMemo<ProductSolution[]>(
    () => (location.query.product ?? []) as ProductSolution[],
    [location.query.product]
  );

  // SDK instrumentation
  const [hasError, setHasError] = useState(false);
  const [platformDocs, setPlatformDocs] = useState<OnboardingPlatformDoc | null>(null);
  const [loadedPlatform, setLoadedPlatform] = useState<PlatformKey | null>(null);

  const currentPlatformKey = loadedPlatform ?? project?.platform ?? 'other';
  const [showLoaderOnboarding, setShowLoaderOnboarding] = useState(
    currentPlatformKey === 'javascript'
  );

  useEffect(() => {
    setShowLoaderOnboarding(currentPlatformKey === 'javascript');
  }, [currentPlatformKey]);

  const integrationSlug = project?.platform && platformToIntegrationMap[project.platform];
  const [integrationUseManualSetup, setIntegrationUseManualSetup] = useState(false);

  const showIntegrationOnboarding = integrationSlug && !integrationUseManualSetup;
  const showDocsWithProductSelection =
    currentPlatformKey.match('^javascript-([A-Za-z]+)$') ??
    (showLoaderOnboarding === false && currentPlatformKey === 'javascript');

  const hideLoaderOnboarding = useCallback(() => {
    setShowLoaderOnboarding(false);

    if (!project?.id) {
      return;
    }

    trackAnalytics('onboarding.js_loader_npm_docs_shown', {
      organization,
      platform: currentPlatformKey,
      project_id: project?.id,
    });
  }, [organization, currentPlatformKey, project?.id]);

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

  const currentPlatform = platforms.find(p => p.id === currentPlatformKey);
  const platformName = currentPlatform?.name ?? '';
  const loadLocalSdkDocumentation =
    currentPlatform && migratedDocs.includes(currentPlatformKey);

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
          ) : showLoaderOnboarding ? (
            <Fragment>
              <SetupIntroduction
                stepHeaderText={t(
                  'Configure %s SDK',
                  platforms.find(p => p.id === currentPlatformKey)?.name ?? ''
                )}
                platform={currentPlatformKey}
              />
              <SetupDocsLoader
                organization={organization}
                project={project}
                location={location}
                platform={loadedPlatform}
                close={hideLoaderOnboarding}
              />
            </Fragment>
          ) : loadLocalSdkDocumentation ? (
            <Fragment>
              <SetupIntroduction
                stepHeaderText={t('Configure %s SDK', platformName)}
                platform={currentPlatformKey}
              />
              <SdkDocumentation
                platform={currentPlatform}
                organization={organization}
                projectSlug={project.slug}
                projectId={project.id}
                activeProductSelection={products}
                newOrg
              />
            </Fragment>
          ) : (
            <ProjectDocs
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
                platform: currentPlatformKey,
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
              platform: currentPlatformKey,
              project_id: project.id,
            });
            browserHistory.push(orgIssuesURL);
          }}
        />
      )}
    </Fragment>
  );
}

export default SetupDocs;

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

const DocsWrapper = styled(motion.div)``;

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
