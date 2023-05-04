import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import {Location} from 'history';

import {loadDocs} from 'sentry/actionCreators/projects';
import {Alert} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DocumentationWrapper} from 'sentry/components/onboarding/documentationWrapper';
import {Footer} from 'sentry/components/onboarding/footer';
import {FooterWithViewSampleErrorButton} from 'sentry/components/onboarding/footerWithViewSampleErrorButton';
import {PRODUCT, ProductSelection} from 'sentry/components/onboarding/productSelection';
import {PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import getDynamicText from 'sentry/utils/getDynamicText';
import {platformToIntegrationMap} from 'sentry/utils/integrationUtil';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useExperiment} from 'sentry/utils/useExperiment';
import useOrganization from 'sentry/utils/useOrganization';
import SetupIntroduction from 'sentry/views/onboarding/components/setupIntroduction';
import {SetupDocsLoader} from 'sentry/views/onboarding/setupDocsLoader';

import FirstEventFooter from './components/firstEventFooter';
import IntegrationSetup from './integrationSetup';
import {StepProps} from './types';
/**
 * The documentation will include the following string should it be missing the
 * verification example, which currently a lot of docs are.
 */
const INCOMPLETE_DOC_FLAG = 'TODO-ADD-VERIFICATION-EXAMPLE';

type PlatformDoc = {html: string; link: string};

function MissingExampleWarning({
  platformDocs,
  platform,
}: {
  platform: PlatformKey | null;
  platformDocs: PlatformDoc | null;
}) {
  const missingExample = platformDocs?.html.includes(INCOMPLETE_DOC_FLAG);

  if (!missingExample) {
    return null;
  }

  return (
    <Alert type="warning" showIcon>
      {tct(
        `Looks like this getting started example is still undergoing some
         work and doesn't include an example for triggering an event quite
         yet. If you have trouble sending your first event be sure to consult
         the [docsLink:full documentation] for [platform].`,
        {
          docsLink: <ExternalLink href={platformDocs?.link} />,
          platform: platforms.find(p => p.id === platform)?.name,
        }
      )}
    </Alert>
  );
}

export function DocWithProductSelection({
  organization,
  location,
  projectSlug,
  newOrg,
  currentPlatform,
}: {
  currentPlatform: PlatformKey;
  location: Location;
  organization: Organization;
  projectSlug: Project['slug'];
  newOrg?: boolean;
}) {
  const loadPlatform = useMemo(() => {
    const products = location.query.product ?? [];
    return products.includes(PRODUCT.PERFORMANCE_MONITORING) &&
      products.includes(PRODUCT.SESSION_REPLAY)
      ? `${currentPlatform}-with-error-monitoring-performance-and-replay`
      : products.includes(PRODUCT.PERFORMANCE_MONITORING)
      ? `${currentPlatform}-with-error-monitoring-and-performance`
      : products.includes(PRODUCT.SESSION_REPLAY)
      ? `${currentPlatform}-with-error-monitoring-and-replay`
      : `${currentPlatform}-with-error-monitoring`;
  }, [location.query.product, currentPlatform]);

  const {data, isLoading, isError, refetch} = useApiQuery<PlatformDoc>(
    [`/projects/${organization.slug}/${projectSlug}/docs/${loadPlatform}/`],
    {
      staleTime: Infinity,
      enabled: !!projectSlug && !!organization.slug && !!loadPlatform,
    }
  );

  const platformName = platforms.find(p => p.id === currentPlatform)?.name ?? '';

  return (
    <Fragment>
      {newOrg && (
        <SetupIntroduction
          stepHeaderText={t('Configure %s SDK', platformName)}
          platform={currentPlatform}
        />
      )}
      <ProductSelection
        defaultSelectedProducts={[PRODUCT.PERFORMANCE_MONITORING, PRODUCT.SESSION_REPLAY]}
      />
      {isLoading ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError
          message={t('Failed to load documentation for the %s platform.', platformName)}
          onRetry={refetch}
        />
      ) : (
        getDynamicText({
          value: (
            <DocsWrapper>
              <DocumentationWrapper
                dangerouslySetInnerHTML={{__html: data?.html ?? ''}}
              />
              <MissingExampleWarning
                platform={currentPlatform}
                platformDocs={{
                  html: data?.html ?? '',
                  link: data?.link ?? '',
                }}
              />
            </DocsWrapper>
          ),
          fixed: (
            <Alert type="warning">
              Platform documentation is not rendered in for tests in CI
            </Alert>
          ),
        })
      )}
    </Fragment>
  );
}

function ProjectDocs(props: {
  hasError: boolean;
  onRetry: () => void;
  organization: Organization;
  platform: PlatformKey | null;
  platformDocs: PlatformDoc | null;
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
  const showDocsWithProductSelection = currentPlatform.match('^javascript-([A-Za-z]+)$');

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
            <DocWithProductSelection
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
              <SetupDocsLoader
                organization={organization}
                project={project}
                location={location}
                platform={loadedPlatform}
                close={hideLoaderOnboarding}
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
