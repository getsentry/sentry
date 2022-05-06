import 'prism-sentry/index.css';

import {Fragment, useEffect, useState} from 'react';
import {browserHistory} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import * as qs from 'query-string';

import {loadDocs} from 'sentry/actionCreators/projects';
import Alert, {alertStyles} from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import {PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import getDynamicText from 'sentry/utils/getDynamicText';
import {Theme} from 'sentry/utils/theme';
import useApi from 'sentry/utils/useApi';
import withProjects from 'sentry/utils/withProjects';

import FirstEventFooter from './components/firstEventFooter';
import FullIntroduction from './components/fullIntroduction';
import TargetedOnboardingSidebar from './components/sidebar';
import {StepProps} from './types';
import {usePersistedOnboardingState} from './utils';

/**
 * The documentation will include the following string should it be missing the
 * verification example, which currently a lot of docs are.
 */
const INCOMPLETE_DOC_FLAG = 'TODO-ADD-VERIFICATION-EXAMPLE';

type PlatformDoc = {html: string; link: string};

type Props = {
  projects: Project[];
  search: string;
} & StepProps;

function SetupDocs({organization, projects, search}: Props) {
  const api = useApi();
  const [clientState, setClientState] = usePersistedOnboardingState();
  const selectedProjectsSet = new Set(
    clientState?.selectedPlatforms.map(
      platform => clientState.platformToProjectIdMap[platform]
    ) || []
  );

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
  const {sub_step: rawSubStep, project_id: rawProjectId} = qs.parse(search);
  const subStep = rawSubStep === 'integration' ? 'integration' : 'project';
  const rawProjectIndex = projects.findIndex(p => p.id === rawProjectId);
  const firstProjectNoError = projects.findIndex(
    p => selectedProjectsSet.has(p.slug) && !checkProjectHasFirstEvent(p)
  );
  // Select a project based on search params. If non exist, use the first project without first event.
  const projectIndex = rawProjectIndex >= 0 ? rawProjectIndex : firstProjectNoError;
  const project = projects[projectIndex];

  useEffect(() => {
    if (clientState && !project && projects.length > 0) {
      // Can't find a project to show, probably because all projects are either deleted or finished.
      browserHistory.push('/');
    }
  }, [clientState, project, projects]);

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
      project_id: newProjectId,
    });
    browserHistory.push(`${window.location.pathname}?${searchParams}`);
    if (clientState) {
      setClientState({
        ...clientState,
        state: 'projects_selected',
        url: `setup-docs/?${searchParams}`,
      });
    }
  };

  const selectProject = (newProjectId: string) => {
    const matchedProject = projects.find(p => p.id === newProjectId);
    trackAdvancedAnalyticsEvent('growth.onboarding_clicked_project_in_sidebar', {
      organization,
      platform: matchedProject?.platform || 'unknown',
    });
    setNewProject(newProjectId);
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
      message={t('Failed to load documentation for the %s platform.', project.platform)}
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
        <TargetedOnboardingSidebar
          projects={projects}
          selectedPlatformToProjectIdMap={
            clientState
              ? Object.fromEntries(
                  clientState.selectedPlatforms.map(platform => [
                    platform,
                    clientState.platformToProjectIdMap[platform],
                  ])
                )
              : {}
          }
          activeProject={project}
          {...{checkProjectHasFirstEvent, selectProject}}
        />
        <MainContent>
          <FullIntroduction
            currentPlatform={currentPlatform}
            organization={organization}
          />
          {getDynamicText({
            value: !hasError ? docs : loadingError,
            fixed: testOnlyAlert,
          })}
        </MainContent>
      </Wrapper>

      {project && (
        <FirstEventFooter
          project={project}
          organization={organization}
          isLast={
            !!clientState &&
            project.slug ===
              clientState.platformToProjectIdMap[
                clientState.selectedPlatforms[clientState.selectedPlatforms.length - 1]
              ]
          }
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
            const platformIndex = clientState.selectedPlatforms.indexOf(project.platform);
            const nextPlatform = clientState.selectedPlatforms[platformIndex + 1];
            const nextProjectSlug =
              nextPlatform && clientState.platformToProjectIdMap[nextPlatform];
            const nextProject = projects.find(p => p.slug === nextProjectSlug);
            if (!nextProject) {
              // We're done here.
              setClientState({
                ...clientState,
                state: 'finished',
              });
              // TODO: integrations
              browserHistory.push(orgIssuesURL);
              return;
            }
            setNewProject(nextProject.id);
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

export default withProjects(SetupDocs);

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
