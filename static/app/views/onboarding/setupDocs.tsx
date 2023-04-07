import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import {Location} from 'history';
import * as qs from 'query-string';

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
import platforms, {ReactDocVariant} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import getDynamicText from 'sentry/utils/getDynamicText';
import {platformToIntegrationMap} from 'sentry/utils/integrationUtil';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useExperiment} from 'sentry/utils/useExperiment';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import SetupIntroduction from 'sentry/views/onboarding/components/setupIntroduction';
import {SetupDocsLoader} from 'sentry/views/onboarding/setupDocsLoader';

import FirstEventFooter from './components/firstEventFooter';
import ProjectSidebarSection from './components/projectSidebarSection';
import IntegrationSetup from './integrationSetup';
import {StepProps} from './types';
import {usePersistedOnboardingState} from './utils';
/**
 * The documentation will include the following string should it be missing the
 * verification example, which currently a lot of docs are.
 */
const INCOMPLETE_DOC_FLAG = 'TODO-ADD-VERIFICATION-EXAMPLE';

type PlatformDoc = {html: string; link: string};

type Props = {
  search: string;
} & StepProps;

const MissingExampleWarning = ({
  platformDocs,
  platform,
}: {
  platform: PlatformKey | null;
  platformDocs: PlatformDoc | null;
}) => {
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
};

export function ProjectDocsReact({
  organization,
  location,
  projectSlug,
  newOrg,
}: {
  location: Location;
  organization: Organization;
  projectSlug: Project['slug'];
  newOrg?: boolean;
}) {
  const {
    experimentAssignment: productSelectionAssignment,
    logExperiment: productSelectionLogExperiment,
  } = useExperiment('OnboardingProductSelectionExperiment', {
    logExperimentOnMount: false,
  });

  // This is an experiment we are doing with react.
  // In this experiment we let the user choose which Sentry product he would like to have in his `Sentry.Init()`
  // and the docs will reflect that.
  const loadPlatform = useMemo(() => {
    const products = location.query.product ?? [];
    return newOrg && productSelectionAssignment === 'baseline'
      ? 'javascript-react'
      : products.includes(PRODUCT.PERFORMANCE_MONITORING) &&
        products.includes(PRODUCT.SESSION_REPLAY)
      ? ReactDocVariant.ErrorMonitoringPerformanceAndReplay
      : products.includes(PRODUCT.PERFORMANCE_MONITORING)
      ? ReactDocVariant.ErrorMonitoringAndPerformance
      : products.includes(PRODUCT.SESSION_REPLAY)
      ? ReactDocVariant.ErrorMonitoringAndSessionReplay
      : ReactDocVariant.ErrorMonitoring;
  }, [location.query.product, productSelectionAssignment, newOrg]);

  useEffect(() => {
    if (!newOrg) {
      return;
    }
    productSelectionLogExperiment();
  }, [productSelectionLogExperiment, newOrg]);

  const {data, isLoading, isError, refetch} = useApiQuery<PlatformDoc>(
    [`/projects/${organization.slug}/${projectSlug}/docs/${loadPlatform}/`],
    {
      staleTime: Infinity,
      enabled: !!projectSlug && !!organization.slug && !!loadPlatform,
    }
  );

  return (
    <Fragment>
      {newOrg ? (
        <Fragment>
          <SetupIntroduction
            stepHeaderText={t(
              'Configure %s SDK',
              platforms.find(p => p.id === 'javascript-react')?.name ?? ''
            )}
            platform="javascript-react"
          />
          {productSelectionAssignment === 'variant1' ? (
            <ProductSelection
              defaultSelectedProducts={[
                PRODUCT.PERFORMANCE_MONITORING,
                PRODUCT.SESSION_REPLAY,
              ]}
            />
          ) : productSelectionAssignment === 'variant2' ? (
            <ProductSelection />
          ) : null}
        </Fragment>
      ) : (
        <ProductSelection
          defaultSelectedProducts={[
            PRODUCT.PERFORMANCE_MONITORING,
            PRODUCT.SESSION_REPLAY,
          ]}
        />
      )}
      {isLoading ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError
          message={t('Failed to load documentation for the React platform.')}
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
                platform="javascript-react"
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

function SetupDocs({search, route, router, location, ...props}: Props) {
  const api = useApi();
  const organization = useOrganization();
  const {projects: rawProjects} = useProjects();
  const [clientState, setClientState] = usePersistedOnboardingState();
  const [selectedProjectSlug, _setSelectedProjectSlug] = useState(
    props.selectedProjectSlug
  );

  const {
    logExperiment: newFooterLogExperiment,
    experimentAssignment: newFooterAssignment,
  } = useExperiment('OnboardingNewFooterExperiment', {
    logExperimentOnMount: false,
  });

  const singleSelectPlatform = !!organization?.features.includes(
    'onboarding-remove-multiselect-platform'
  );

  const heartbeatFooter = !!organization?.features.includes(
    'onboarding-heartbeat-footer'
  );

  const docsWithProductSelection = !!organization.features?.includes(
    'onboarding-docs-with-product-selection'
  );

  const loaderOnboarding = !!organization.features?.includes('onboarding-project-loader');

  const jsDynamicLoader = !!organization.features?.includes('js-sdk-dynamic-loader');

  const selectedPlatforms = clientState?.selectedPlatforms || [];
  const platformToProjectIdMap = clientState?.platformToProjectIdMap || {};
  // id is really slug here
  const projectSlugs = selectedPlatforms
    .map(platform => platformToProjectIdMap[platform])
    .filter((slug): slug is string => slug !== undefined);

  const selectedProjectsSet = new Set(projectSlugs);
  // get projects in the order they appear in selectedPlatforms
  const projects = projectSlugs
    .map(slug => rawProjects.find(project => project.slug === slug))
    .filter((project): project is Project => project !== undefined);

  // SDK instrumentation
  const [hasError, setHasError] = useState(false);
  const [platformDocs, setPlatformDocs] = useState<PlatformDoc | null>(null);
  const [loadedPlatform, setLoadedPlatform] = useState<PlatformKey | null>(null);

  // store what projects have sent first event in state based project.firstEvent
  const [hasFirstEventMap, setHasFirstEventMap] = useState<Record<string, boolean>>(
    projects.reduce((accum, project: Project) => {
      accum[project.id] = !!project.firstEvent;
      return accum;
    }, {} as Record<string, boolean>)
  );

  const checkProjectHasFirstEvent = (project: Project) => {
    return !!hasFirstEventMap[project.id];
  };

  const {project_id: rawProjectId} = qs.parse(search);
  const rawProjectIndex = projects.findIndex(p => p.id === rawProjectId);
  const firstProjectNoError = projects.findIndex(p => selectedProjectsSet.has(p.slug));
  // Select a project based on search params. If non exist, use the first project without first event.
  const projectIndex = rawProjectIndex >= 0 ? rawProjectIndex : firstProjectNoError;
  const project =
    projects[projectIndex] ?? rawProjects.find(p => p.slug === selectedProjectSlug);

  // find the next project that doesn't have a first event
  const nextProject = projects.find(
    (p, i) => i > projectIndex && !checkProjectHasFirstEvent(p)
  );

  const integrationSlug = project?.platform && platformToIntegrationMap[project.platform];
  const [integrationUseManualSetup, setIntegrationUseManualSetup] = useState(false);

  const currentPlatform = loadedPlatform ?? project?.platform ?? 'other';

  const [showLoaderOnboarding, setShowLoaderOnboarding] = useState(
    loaderOnboarding && jsDynamicLoader && currentPlatform === 'javascript'
  );

  const showIntegrationOnboarding = integrationSlug && !integrationUseManualSetup;
  const showReactOnboarding =
    currentPlatform === 'javascript-react' && docsWithProductSelection;

  const hideLoaderOnboarding = useCallback(() => {
    setShowLoaderOnboarding(false);

    if (!project?.id) {
      return;
    }

    trackAdvancedAnalyticsEvent('onboarding.js_loader_npm_docs_shown', {
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

    // this will be fetched in the SetupDocsReact component
    if (showReactOnboarding) {
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
    showReactOnboarding,
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

  const setNewProject = (newProjectId: string) => {
    setLoadedPlatform(null);
    setPlatformDocs(null);
    setHasError(false);
    setIntegrationUseManualSetup(false);
    const searchParams = new URLSearchParams({
      sub_step: 'project',
      project_id: newProjectId,
    });
    browserHistory.push(`${window.location.pathname}?${searchParams}`);
    clientState &&
      setClientState({
        ...clientState,
        state: 'projects_selected',
        url: `setup-docs/?${searchParams}`,
      });
  };

  const selectProject = (newProjectId: string) => {
    const matchedProject = projects.find(p => p.id === newProjectId);
    trackAdvancedAnalyticsEvent('growth.onboarding_clicked_project_in_sidebar', {
      organization,
      platform: matchedProject?.platform || 'unknown',
    });
    setNewProject(newProjectId);
  };

  return (
    <Fragment>
      <Wrapper>
        {!singleSelectPlatform && (
          <SidebarWrapper>
            <ProjectSidebarSection
              projects={projects}
              selectedPlatformToProjectIdMap={Object.fromEntries(
                selectedPlatforms.map(platform => [
                  platform,
                  platformToProjectIdMap[platform],
                ])
              )}
              activeProject={project}
              {...{checkProjectHasFirstEvent, selectProject}}
            />
          </SidebarWrapper>
        )}
        <MainContent>
          {showIntegrationOnboarding ? (
            <IntegrationSetup
              integrationSlug={integrationSlug}
              project={project}
              onClickManualSetup={() => {
                setIntegrationUseManualSetup(true);
              }}
            />
          ) : showReactOnboarding ? (
            <ProjectDocsReact
              organization={organization}
              projectSlug={project.slug}
              location={location}
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
            isLast={!nextProject}
            hasFirstEvent={checkProjectHasFirstEvent(project)}
            onClickSetupLater={() => {
              const orgIssuesURL = `/organizations/${organization.slug}/issues/?project=${project.id}&referrer=onboarding-setup-docs`;
              trackAdvancedAnalyticsEvent(
                'growth.onboarding_clicked_setup_platform_later',
                {
                  organization,
                  platform: currentPlatform,
                  project_index: projectIndex,
                }
              );
              if (!project.platform || !clientState) {
                browserHistory.push(orgIssuesURL);
                return;
              }
              // if we have a next project, switch to that
              if (nextProject) {
                setNewProject(nextProject.id);
              } else {
                setClientState({
                  ...clientState,
                  state: 'finished',
                });
                browserHistory.push(orgIssuesURL);
              }
            }}
            handleFirstIssueReceived={() => {
              const newHasFirstEventMap = {...hasFirstEventMap, [project.id]: true};
              setHasFirstEventMap(newHasFirstEventMap);
            }}
          />
        )
      ) : (
        <FirstEventFooter
          project={project}
          organization={organization}
          isLast={!nextProject}
          hasFirstEvent={checkProjectHasFirstEvent(project)}
          onClickSetupLater={() => {
            const orgIssuesURL = `/organizations/${organization.slug}/issues/?project=${project.id}&referrer=onboarding-setup-docs`;
            trackAdvancedAnalyticsEvent(
              'growth.onboarding_clicked_setup_platform_later',
              {
                organization,
                platform: currentPlatform,
                project_index: projectIndex,
              }
            );
            if (!project.platform || !clientState) {
              browserHistory.push(orgIssuesURL);
              return;
            }
            // if we have a next project, switch to that
            if (nextProject) {
              setNewProject(nextProject.id);
            } else {
              setClientState({
                ...clientState,
                state: 'finished',
              });
              browserHistory.push(orgIssuesURL);
            }
          }}
          handleFirstIssueReceived={() => {
            const newHasFirstEventMap = {...hasFirstEventMap, [project.id]: true};
            setHasFirstEventMap(newHasFirstEventMap);
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

// the number icon will be space(2) + 30px to the left of the margin of center column
// so we need to offset the right margin by that much
// also hide the sidebar if the screen is too small
const SidebarWrapper = styled('div')`
  margin: ${space(1)} calc(${space(2)} + 30px + ${space(4)}) 0 ${space(2)};
  @media (max-width: 1150px) {
    display: none;
  }
  flex-basis: 240px;
  flex-grow: 0;
  flex-shrink: 0;
  min-width: 240px;
`;
