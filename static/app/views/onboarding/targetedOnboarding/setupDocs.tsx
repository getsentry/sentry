import 'prism-sentry/index.css';

import {Fragment, useEffect, useState} from 'react';
import {browserHistory} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import * as qs from 'query-string';

import {loadDocs} from 'sentry/actionCreators/projects';
import Alert, {alertStyles} from 'sentry/components/alert';
import AsyncComponent from 'sentry/components/asyncComponent';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import {PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Integration, IntegrationProvider, Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import getDynamicText from 'sentry/utils/getDynamicText';
import {Theme} from 'sentry/utils/theme';
import useApi from 'sentry/utils/useApi';
import withProjects from 'sentry/utils/withProjects';

import FirstEventFooter from './components/firstEventFooter';
import FullIntroduction from './components/fullIntroduction';
import IntegrationInstaller from './components/integrationInstaller';
import IntegrationSidebarSection from './components/integrationSidebarSection';
import ProjectSidebarSection from './components/projectSidebarSection';
import SetupIntegrationsFooter from './components/setupIntegrationsFooter';
import {StepProps} from './types';
import {usePersistedOnboardingState} from './utils';

/**
 * The documentation will include the following string should it be missing the
 * verification example, which currently a lot of docs are.
 */
const INCOMPLETE_DOC_FLAG = 'TODO-ADD-VERIFICATION-EXAMPLE';

type PlatformDoc = {html: string; link: string};

type Props = {
  configurations: Integration[];
  projects: Project[];
  providers: IntegrationProvider[];
  search: string;
  loadingProjects?: boolean;
} & StepProps;

function SetupDocs({
  organization,
  projects: rawProjects,
  search,
  configurations,
  providers,
  loadingProjects,
}: Props) {
  const api = useApi();
  const [clientState, setClientState] = usePersistedOnboardingState();
  const selectedPlatforms = clientState?.selectedPlatforms || [];
  const selectedIntegrations = clientState?.selectedIntegrations || [];
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

  // TODO: Check no projects
  const {
    sub_step: rawSubStep,
    project_id: rawProjectId,
    integration: rawActiveIntegration,
  } = qs.parse(search);
  const subStep = rawSubStep === 'integration' ? 'integration' : 'project';
  const rawProjectIndex = projects.findIndex(p => p.id === rawProjectId);
  const firstProjectNoError = projects.findIndex(
    p => selectedProjectsSet.has(p.slug) && !checkProjectHasFirstEvent(p)
  );
  // Select a project based on search params. If non exist, use the first project without first event.
  const projectIndex = rawProjectIndex >= 0 ? rawProjectIndex : firstProjectNoError;
  const project = subStep === 'project' ? projects[projectIndex] : null;
  // find the next project that doesn't have a first event
  const nextProject = projects.find(
    (p, i) => i > projectIndex && !checkProjectHasFirstEvent(p)
  );

  // integration installation
  const [installedIntegrations, setInstalledIntegrations] = useState(
    new Set(configurations.map(config => config.provider.slug))
  );
  const integrationsNotInstalled = selectedIntegrations.filter(
    i => !installedIntegrations.has(i)
  );
  const setIntegrationInstalled = (integration: string) =>
    setInstalledIntegrations(new Set([...installedIntegrations, integration]));

  const rawActiveIntegrationIndex = selectedIntegrations.findIndex(
    i => i === rawActiveIntegration
  );

  const firstUninstalledIntegrationIndex = selectedIntegrations.findIndex(
    i => !installedIntegrations.has(i)
  );

  const activeIntegrationIndex =
    rawActiveIntegrationIndex >= 0
      ? rawActiveIntegrationIndex
      : firstUninstalledIntegrationIndex;

  const activeIntegration =
    subStep === 'integration' ? selectedIntegrations[activeIntegrationIndex] : null;
  const activeProvider = activeIntegration
    ? providers.find(p => p.key === activeIntegration)
    : null;

  useEffect(() => {
    // should not redirect if we don't have an active client state or projects aren't loaded
    if (!clientState || loadingProjects) {
      return;
    }
    if (
      // no integrations left on integration step
      (subStep === 'integration' && !activeIntegration) ||
      // If no projects remaining and no integrations to install, then we can leave
      (subStep === 'project' && !project && !integrationsNotInstalled.length)
    ) {
      browserHistory.push('/');
    }
  });

  const currentPlatform = loadedPlatform ?? project?.platform ?? 'other';

  const fetchData = async () => {
    // const {platform} = project || {};
    // TODO: add better error handling logic
    if (!project?.platform) {
      return;
    }
    try {
      const loadedDocs = await loadDocs(
        api,
        organization.slug,
        project.slug,
        project.platform
      );
      setPlatformDocs(loadedDocs);
      setLoadedPlatform(project.platform);
      setHasError(false);
    } catch (error) {
      setHasError(error);
      throw error;
    }
  };

  useEffect(() => {
    fetchData();
  }, [project]);

  // TODO: add better error handling logic
  if (!project && subStep === 'project') {
    return null;
  }

  const setNewProject = (newProjectId: string) => {
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

  const setNewActiveIntegration = (integration: string) => {
    const searchParams = new URLSearchParams({
      integration,
      sub_step: 'integration',
    });
    browserHistory.push(`${window.location.pathname}?${searchParams}`);
    if (clientState) {
      setClientState({
        ...clientState,
        state: 'integrations_selected',
        url: `setup-docs/?${searchParams}`,
      });
    }
  };

  const selectActiveIntegration = (integration: string) => {
    trackAdvancedAnalyticsEvent('growth.onboarding_clicked_integration_in_sidebar', {
      organization,
      integration,
    });
    setNewActiveIntegration(integration);
  };

  const missingExampleWarning = () => {
    const missingExample =
      platformDocs && platformDocs.html.includes(INCOMPLETE_DOC_FLAG);

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
            platform: platforms.find(p => p.id === loadedPlatform)?.name,
          }
        )}
      </Alert>
    );
  };

  const docs = platformDocs !== null && (
    <DocsWrapper key={platformDocs.html}>
      <Content dangerouslySetInnerHTML={{__html: platformDocs.html}} />
      {missingExampleWarning()}
    </DocsWrapper>
  );

  const loadingError = (
    <LoadingError
      message={t('Failed to load documentation for the %s platform.', project?.platform)}
      onRetry={fetchData}
    />
  );

  const testOnlyAlert = (
    <Alert type="warning">
      Platform documentation is not rendered in for tests in CI
    </Alert>
  );

  return (
    <Fragment>
      <Wrapper>
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
          {selectedIntegrations.length &&
          organization.experiments.TargetedOnboardingIntegrationSelectExperiment ? (
            <IntegrationSidebarSection
              {...{
                installedIntegrations,
                selectedIntegrations,
                activeIntegration,
                selectActiveIntegration,
                providers,
              }}
            />
          ) : null}
        </SidebarWrapper>
        <MainContent>
          {subStep === 'project' ? (
            <Fragment>
              <FullIntroduction
                currentPlatform={currentPlatform}
                organization={organization}
              />
              {getDynamicText({
                value: !hasError ? docs : loadingError,
                fixed: testOnlyAlert,
              })}
            </Fragment>
          ) : null}
          {activeProvider && (
            <IntegrationInstaller
              provider={activeProvider}
              isInstalled={installedIntegrations.has(activeProvider.slug)}
              setIntegrationInstalled={() => setIntegrationInstalled(activeProvider.slug)}
            />
          )}
        </MainContent>
      </Wrapper>

      {project && (
        <FirstEventFooter
          project={project}
          organization={organization}
          isLast={!nextProject}
          hasFirstEvent={checkProjectHasFirstEvent(project)}
          onClickSetupLater={() => {
            const orgIssuesURL = `/organizations/${organization.slug}/issues/?project=${project.id}`;
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
              // if we have integrations to install switch to that
            } else if (integrationsNotInstalled.length) {
              setNewActiveIntegration(integrationsNotInstalled[0]);
              // otherwise no integrations and no projects so we're done
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
      {activeIntegration && (
        <SetupIntegrationsFooter
          organization={organization}
          onClickSetupLater={() => {
            trackAdvancedAnalyticsEvent(
              'growth.onboarding_clicked_setup_integration_later',
              {
                organization,
                integration: activeIntegration,
                integration_index: activeIntegrationIndex,
              }
            );
            // find the next uninstalled integration
            const nextIntegration = selectedIntegrations.find(
              (i, index) =>
                !installedIntegrations.has(i) && index > activeIntegrationIndex
            );
            // check if we have an integration to set up next
            if (nextIntegration) {
              setNewActiveIntegration(nextIntegration);
            } else {
              // client state should always exist
              clientState &&
                setClientState({
                  ...clientState,
                  state: 'finished',
                });
              const nextUrl = `/organizations/${organization.slug}/issues/`;
              browserHistory.push(nextUrl);
            }
          }}
        />
      )}
    </Fragment>
  );
}

type WrapperState = {
  configurations: Integration[] | null;
  information: {providers: IntegrationProvider[]} | null;
} & AsyncComponent['state'];

type WrapperProps = {
  projects: Project[];
  search: string;
} & StepProps &
  AsyncComponent['props'];

class SetupDocsWrapper extends AsyncComponent<WrapperProps, WrapperState> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {slug, experiments} = this.props.organization;
    // would be better to check the onboarding state for integrations instead of the experiment
    // but we can't access a hook from a class component
    if (!experiments.TargetedOnboardingIntegrationSelectExperiment) {
      return [];
    }
    return [
      ['information', `/organizations/${slug}/config/integrations/`],
      ['configurations', `/organizations/${slug}/integrations/?includeConfig=0`],
    ];
  }
  renderBody() {
    const {configurations, information} = this.state;
    return (
      <SetupDocs
        {...this.props}
        configurations={configurations ?? []}
        providers={information?.providers || []}
      />
    );
  }
}

export default withProjects(SetupDocsWrapper);

type AlertType = React.ComponentProps<typeof Alert>['type'];

const getAlertSelector = (type: AlertType) =>
  type === 'muted' ? null : `.alert[level="${type}"], .alert-${type}`;

const mapAlertStyles = (p: {theme: Theme}, type: AlertType) =>
  css`
    ${getAlertSelector(type)} {
      ${alertStyles({theme: p.theme, type})};
      display: block;
    }
  `;

const Content = styled(motion.div)`
  h1,
  h2,
  h3,
  h4,
  h5,
  h6,
  p {
    margin-bottom: 18px;
  }

  div[data-language] {
    margin-bottom: ${space(2)};
  }

  code {
    font-size: 87.5%;
    color: ${p => p.theme.pink300};
  }

  pre code {
    color: inherit;
    font-size: inherit;
    white-space: pre;
  }

  h2 {
    font-size: 1.4em;
  }

  .alert h5 {
    font-size: 1em;
    margin-bottom: 0.625rem;
  }

  /**
   * XXX(epurkhiser): This comes from the doc styles and avoids bottom margin issues in alerts
   */
  .content-flush-bottom *:last-child {
    margin-bottom: 0;
  }

  ${p => Object.keys(p.theme.alert).map(type => mapAlertStyles(p, type as AlertType))}
`;

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
