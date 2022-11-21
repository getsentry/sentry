import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import HighlightTopRightPattern from 'sentry-images/pattern/highlight-top-right.svg';

import Button from 'sentry/components/button';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import useOnboardingDocs from 'sentry/components/onboardingWizard/useOnboardingDocs';
import OnboardingStep from 'sentry/components/sidebar/onboardingStep';
import SidebarPanel from 'sentry/components/sidebar/sidebarPanel';
import {CommonSidebarProps, SidebarPanelKey} from 'sentry/components/sidebar/types';
import {withoutPerformanceSupport} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import EventWaiter from 'sentry/utils/eventWaiter';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import useProjects from 'sentry/utils/useProjects';

import {filterProjects, generateDocKeys, isPlatformSupported} from './utils';

function PerformanceOnboardingSidebar(props: CommonSidebarProps) {
  const {currentPanel, collapsed, hidePanel, orientation} = props;
  const isActive = currentPanel === SidebarPanelKey.PerformanceOnboarding;
  const organization = useOrganization();
  const hasProjectAccess = organization.access.includes('project:read');

  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  const [currentProject, setCurrentProject] = useState<Project | undefined>(undefined);

  const {selection, isReady} = useLegacyStore(PageFiltersStore);

  const {projectsWithoutFirstTransactionEvent, projectsForOnboarding} =
    filterProjects(projects);

  useEffect(() => {
    if (
      currentProject ||
      projects.length === 0 ||
      !isReady ||
      !isActive ||
      projectsWithoutFirstTransactionEvent.length <= 0
    ) {
      return;
    }
    // Establish current project

    const projectMap: Record<string, Project> = projects.reduce((acc, project) => {
      acc[project.id] = project;
      return acc;
    }, {});

    if (selection.projects.length) {
      const projectSelection = selection.projects.map(
        projectId => projectMap[String(projectId)]
      );

      // Among the project selection, find a project that has performance onboarding docs support, and has not sent
      // a first transaction event.
      const maybeProject = projectSelection.find(project =>
        projectsForOnboarding.includes(project)
      );
      if (maybeProject) {
        setCurrentProject(maybeProject);
        return;
      }

      // Among the project selection, find a project that has not sent a first transaction event
      const maybeProjectFallback = projectSelection.find(project =>
        projectsWithoutFirstTransactionEvent.includes(project)
      );
      if (maybeProjectFallback) {
        setCurrentProject(maybeProjectFallback);
        return;
      }
    }

    // Among the projects, find a project that has performance onboarding docs support, and has not sent
    // a first transaction event.
    if (projectsForOnboarding.length) {
      setCurrentProject(projectsForOnboarding[0]);
      return;
    }

    // Otherwise, pick a first project that has not sent a first transaction event.
    setCurrentProject(projectsWithoutFirstTransactionEvent[0]);
  }, [
    selection.projects,
    projects,
    isActive,
    isReady,
    projectsForOnboarding,
    projectsWithoutFirstTransactionEvent,
    currentProject,
  ]);

  if (
    !isActive ||
    !hasProjectAccess ||
    currentProject === undefined ||
    !projectsLoaded ||
    !projects ||
    projects.length <= 0 ||
    projectsWithoutFirstTransactionEvent.length <= 0
  ) {
    return null;
  }

  const items: MenuItemProps[] = projectsWithoutFirstTransactionEvent.reduce(
    (acc: MenuItemProps[], project) => {
      const itemProps: MenuItemProps = {
        key: project.id,
        label: (
          <StyledIdBadge project={project} avatarSize={16} hideOverflow disableLink />
        ),
        onAction: function switchProject() {
          setCurrentProject(project);
        },
      };

      if (currentProject.id === project.id) {
        acc.unshift(itemProps);
      } else {
        acc.push(itemProps);
      }

      return acc;
    },
    []
  );

  return (
    <TaskSidebarPanel
      orientation={orientation}
      collapsed={collapsed}
      hidePanel={hidePanel}
    >
      <TopRightBackgroundImage src={HighlightTopRightPattern} />
      <TaskList>
        <Heading>{t('Boost Performance')}</Heading>
        <DropdownMenuControl
          items={items}
          triggerLabel={
            <StyledIdBadge
              project={currentProject}
              avatarSize={16}
              hideOverflow
              disableLink
            />
          }
          triggerProps={{'aria-label': currentProject.slug}}
          position="bottom-end"
        />
        <OnboardingContent currentProject={currentProject} />
      </TaskList>
    </TaskSidebarPanel>
  );
}

function OnboardingContent({currentProject}: {currentProject: Project}) {
  const api = useApi();
  const organization = useOrganization();
  const previousProject = usePrevious(currentProject);
  const [received, setReceived] = useState<boolean>(false);

  useEffect(() => {
    if (previousProject.id !== currentProject.id) {
      setReceived(false);
    }
  }, [previousProject.id, currentProject.id]);

  const currentPlatform = currentProject.platform
    ? platforms.find(p => p.id === currentProject.platform)
    : undefined;

  const docKeys = currentPlatform ? generateDocKeys(currentPlatform.id) : [];
  const {docContents, isLoading, hasOnboardingContents} = useOnboardingDocs({
    project: currentProject,
    docKeys,
    isPlatformSupported: isPlatformSupported(currentPlatform),
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  const doesNotSupportPerformance = currentProject.platform
    ? withoutPerformanceSupport.has(currentProject.platform)
    : false;

  if (doesNotSupportPerformance) {
    return (
      <Fragment>
        <div>
          {tct(
            'Fiddlesticks. Performance isn’t available for your [platform] project yet but we’re definitely still working on it. Stay tuned.',
            {platform: currentPlatform?.name || currentProject.slug}
          )}
        </div>
        <div>
          <Button size="sm" href="https://docs.sentry.io/platforms/" external>
            {t('Go to Sentry Documentation')}
          </Button>
        </div>
      </Fragment>
    );
  }

  if (!currentPlatform || !hasOnboardingContents) {
    return (
      <Fragment>
        <div>
          {tct(
            'Fiddlesticks. This checklist isn’t available for your [project] project yet, but for now, go to Sentry docs for installation details.',
            {project: currentProject.slug}
          )}
        </div>
        <div>
          <Button
            size="sm"
            href="https://docs.sentry.io/product/performance/getting-started/"
            external
          >
            {t('Go to documentation')}
          </Button>
        </div>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <div>
        {tct(
          `Adding Performance to your [platform] project is simple. Make sure you've got these basics down.`,
          {platform: currentPlatform?.name || currentProject.slug}
        )}
      </div>
      {docKeys.map((docKey, index) => {
        let footer: React.ReactNode = null;

        if (index === docKeys.length - 1) {
          footer = (
            <EventWaiter
              api={api}
              organization={organization}
              project={currentProject}
              eventType="transaction"
              onIssueReceived={() => {
                setReceived(true);
              }}
            >
              {() => (received ? <EventReceivedIndicator /> : <EventWaitingIndicator />)}
            </EventWaiter>
          );
        }
        return (
          <div key={index}>
            <OnboardingStep
              docContent={docContents[docKey]}
              docKey={docKey}
              prefix="perf"
              project={currentProject}
            />
            {footer}
          </div>
        );
      })}
    </Fragment>
  );
}

const TaskSidebarPanel = styled(SidebarPanel)`
  width: 450px;
`;

const TopRightBackgroundImage = styled('img')`
  position: absolute;
  top: 0;
  right: 0;
  width: 60%;
  user-select: none;
`;

const TaskList = styled('div')`
  display: grid;
  grid-auto-flow: row;
  grid-template-columns: 100%;
  gap: ${space(1)};
  margin: 50px ${space(4)} ${space(4)} ${space(4)};
`;

const Heading = styled('div')`
  display: flex;
  color: ${p => p.theme.activeText};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  text-transform: uppercase;
  font-weight: 600;
  line-height: 1;
  margin-top: ${space(3)};
`;

const StyledIdBadge = styled(IdBadge)`
  overflow: hidden;
  white-space: nowrap;
  flex-shrink: 1;
`;

const PulsingIndicator = styled('div')`
  ${pulsingIndicatorStyles};
  margin-right: ${space(1)};
`;

const EventWaitingIndicator = styled((p: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...p}>
    <PulsingIndicator />
    {t("Waiting for this project's first transaction event")}
  </div>
))`
  display: flex;
  align-items: center;
  flex-grow: 1;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.pink400};
`;

const EventReceivedIndicator = styled((p: React.HTMLAttributes<HTMLDivElement>) => (
  <div {...p}>
    {'🎉 '}
    {t("We've received this project's first transaction event!")}
  </div>
))`
  display: flex;
  align-items: center;
  flex-grow: 1;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.successText};
`;

export default PerformanceOnboardingSidebar;
