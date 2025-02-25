import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import HighlightTopRightPattern from 'sentry-images/pattern/highlight-top-right.svg';

import {LinkButton} from 'sentry/components/button';
import {Alert} from 'sentry/components/core/alert/alert';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import useDrawer from 'sentry/components/globalDrawer';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Step} from 'sentry/components/onboarding/gettingStartedDoc/step';
import type {DocsParams} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import {shouldShowPerformanceTasks} from 'sentry/components/onboardingWizard/filterSupportedTasks';
import SidebarPanel from 'sentry/components/sidebar/sidebarPanel';
import type {CommonSidebarProps} from 'sentry/components/sidebar/types';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {withoutPerformanceSupport} from 'sentry/data/platformCategories';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import EventWaiter from 'sentry/utils/eventWaiter';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import useProjects from 'sentry/utils/useProjects';

import {filterProjects} from './utils';

function decodeProjectIds(projectIds: unknown): string[] | null {
  if (Array.isArray(projectIds)) {
    return projectIds;
  }

  if (typeof projectIds === 'string') {
    return [projectIds];
  }

  return null;
}

export function usePerformanceOnboardingDrawer() {
  const organization = useOrganization();
  const currentPanel = useLegacyStore(SidebarPanelStore);
  const isActive = currentPanel === SidebarPanelKey.PERFORMANCE_ONBOARDING;
  const hasProjectAccess = organization.access.includes('project:read');
  const initialPathname = useRef<string | null>(null);

  const {openDrawer} = useDrawer();

  useEffect(() => {
    if (isActive && hasProjectAccess) {
      initialPathname.current = window.location.pathname;

      openDrawer(() => <DrawerContent />, {
        ariaLabel: t('Boost Performance'),
        // Prevent the drawer from closing when the query params change
        shouldCloseOnLocationChange: location =>
          location.pathname !== initialPathname.current,
      });
    }
  }, [isActive, hasProjectAccess, openDrawer]);
}

function DrawerContent() {
  useEffect(() => {
    return () => {
      SidebarPanelStore.hidePanel();
    };
  }, []);

  return <SidebarContent />;
}

/**
 * @deprecated Use usePerformanceOnboardingDrawer instead.
 */
function LegacyPerformanceOnboardingSidebar(props: CommonSidebarProps) {
  const {currentPanel, collapsed, hidePanel, orientation} = props;
  const organization = useOrganization();
  const isActive = currentPanel === SidebarPanelKey.PERFORMANCE_ONBOARDING;
  const hasProjectAccess = organization.access.includes('project:read');

  if (!isActive || !hasProjectAccess) {
    return null;
  }

  return (
    <TaskSidebarPanel
      orientation={orientation}
      collapsed={collapsed}
      hidePanel={hidePanel}
    >
      <SidebarContent />
    </TaskSidebarPanel>
  );
}

function SidebarContent() {
  const location = useLocation<{project: string[] | null}>();
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  const [currentProject, setCurrentProject] = useState<Project | undefined>(undefined);

  const {selection} = useLegacyStore(PageFiltersStore);

  const {projectsWithoutFirstTransactionEvent, projectsForOnboarding} =
    filterProjects(projects);

  const priorityProjectIds: Set<string> | null = useMemo(() => {
    const decodedProjectIds = decodeProjectIds(location.query.project);
    return decodedProjectIds === null ? null : new Set(decodedProjectIds);
  }, [location.query.project]);

  useEffect(() => {
    if (
      currentProject ||
      projects.length === 0 ||
      projectsWithoutFirstTransactionEvent.length <= 0
    ) {
      return;
    }

    // Establish current project
    if (priorityProjectIds) {
      const projectMap: Record<string, Project> = projects.reduce((acc, project) => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        acc[project.id] = project;
        return acc;
      }, {});

      const priorityProjects: Project[] = [];
      priorityProjectIds.forEach(projectId => {
        priorityProjects.push(projectMap[String(projectId)]!);
      });

      // Among the project selection, find a project that has performance onboarding docs support, and has not sent
      // a first transaction event.
      const maybeProject = priorityProjects.find(project =>
        projectsForOnboarding.includes(project)
      );
      if (maybeProject) {
        setCurrentProject(maybeProject);
        return;
      }

      // Among the project selection, find a project that has not sent a first transaction event
      const maybeProjectFallback = priorityProjects.find(project =>
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
    projectsForOnboarding,
    projectsWithoutFirstTransactionEvent,
    currentProject,
    priorityProjectIds,
  ]);

  // The panel shouldn't be activated in this case, but if so we'll show a message
  if (projects?.length > 0 && !shouldShowPerformanceTasks(projects)) {
    return (
      <Alert type="info">{t("Performance isn't supported for your projects.")}</Alert>
    );
  }

  if (
    currentProject === undefined ||
    !projectsLoaded ||
    !projects ||
    projects.length <= 0
  ) {
    return <LoadingIndicator />;
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

      if (priorityProjectIds?.has(String(project.id))) {
        acc.unshift(itemProps);
      } else {
        acc.push(itemProps);
      }

      return acc;
    },
    []
  );

  return (
    <Fragment>
      <TopRightBackgroundImage src={HighlightTopRightPattern} />
      <TaskList>
        <Heading>{t('Boost Performance')}</Heading>
        <DropdownMenu
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
    </Fragment>
  );
}

function OnboardingContent({currentProject}: {currentProject: Project}) {
  const api = useApi();
  const organization = useOrganization();
  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);
  const [received, setReceived] = useState<boolean>(false);

  const previousProject = usePrevious(currentProject);

  useEffect(() => {
    if (previousProject.id !== currentProject.id) {
      setReceived(false);
    }
  }, [previousProject.id, currentProject.id]);

  const currentPlatform = currentProject.platform
    ? platforms.find(p => p.id === currentProject.platform)
    : undefined;

  const {isLoading, docs, dsn, projectKeyId} = useLoadGettingStarted({
    platform: currentPlatform || otherPlatform,
    orgSlug: organization.slug,
    projSlug: currentProject.slug,
    productType: 'performance',
  });
  const performanceDocs = docs?.performanceOnboarding;

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
          <LinkButton size="sm" href="https://docs.sentry.io/platforms/" external>
            {t('Go to Sentry Documentation')}
          </LinkButton>
        </div>
      </Fragment>
    );
  }

  if (!currentPlatform || !performanceDocs || !dsn || !projectKeyId) {
    return (
      <Fragment>
        <div>
          {tct(
            'Fiddlesticks. This checklist isn’t available for your [project] project yet, but for now, go to Sentry docs for installation details.',
            {project: currentProject.slug}
          )}
        </div>
        <div>
          <LinkButton
            size="sm"
            href="https://docs.sentry.io/product/performance/getting-started/"
            external
          >
            {t('Go to documentation')}
          </LinkButton>
        </div>
      </Fragment>
    );
  }

  const docParams: DocsParams<any> = {
    api,
    projectKeyId,
    dsn,
    organization,
    platformKey: currentProject.platform || 'other',
    projectId: currentProject.id,
    projectSlug: currentProject.slug,
    isFeedbackSelected: false,
    isPerformanceSelected: true,
    isProfilingSelected: false,
    isReplaySelected: false,
    sourcePackageRegistries: {
      isLoading: false,
      data: undefined,
    },
    platformOptions: [ProductSolution.PERFORMANCE_MONITORING],
    newOrg: false,
    feedbackOptions: {},
    urlPrefix,
    isSelfHosted,
  };

  const steps = [
    ...performanceDocs.install(docParams),
    ...performanceDocs.configure(docParams),
    ...performanceDocs.verify(docParams),
  ];

  return (
    <Fragment>
      {performanceDocs.introduction && (
        <Introduction>{performanceDocs.introduction(docParams)}</Introduction>
      )}
      <Steps>
        {steps.map(step => {
          return <Step key={step.title ?? step.type} {...step} />;
        })}
      </Steps>
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
    </Fragment>
  );
}

const Steps = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding-bottom: ${space(1)};
`;

const Introduction = styled('div')`
  display: flex;
  flex-direction: column;
  margin-top: ${space(2)};
  margin-bottom: ${space(2)};
`;

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
  font-weight: ${p => p.theme.fontWeightBold};
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

export default LegacyPerformanceOnboardingSidebar;
