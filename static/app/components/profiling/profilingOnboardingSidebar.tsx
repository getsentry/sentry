import {Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import {CompactSelect} from 'sentry/components/compactSelect';
import useDrawer from 'sentry/components/globalDrawer';
import IdBadge from 'sentry/components/idBadge';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Step} from 'sentry/components/onboarding/gettingStartedDoc/step';
import {
  DocsPageLocation,
  type DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import {TaskSidebar} from 'sentry/components/sidebar/taskSidebar';
import type {CommonSidebarProps} from 'sentry/components/sidebar/types';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {PlatformIntegration, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getDocsPlatformSDKForPlatform} from 'sentry/utils/profiling/platforms';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

function splitProjectsByProfilingSupport(projects: Project[]): {
  supported: Project[];
  unsupported: Project[];
} {
  const [supported, unsupported] = partition(
    projects,
    project => project.platform && getDocsPlatformSDKForPlatform(project.platform)
  );

  return {supported, unsupported};
}

const PROFILING_ONBOARDING_STEPS = [
  ProductSolution.PERFORMANCE_MONITORING,
  ProductSolution.PROFILING,
];

export function useProfilingOnboardingDrawer() {
  const organization = useOrganization();
  const currentPanel = useLegacyStore(SidebarPanelStore);
  const isActive = currentPanel === SidebarPanelKey.PROFILING_ONBOARDING;
  const hasProjectAccess = organization.access.includes('project:read');
  const initialPathname = useRef<string | null>(null);

  const {openDrawer} = useDrawer();

  useLayoutEffect(() => {
    if (isActive && hasProjectAccess) {
      initialPathname.current = window.location.pathname;

      openDrawer(() => <DrawerContent />, {
        ariaLabel: t('Profile Code'),
        // Prevent the drawer from closing when the query params change
        shouldCloseOnLocationChange: location => {
          return location.pathname !== initialPathname.current;
        },
      });
    }
  }, [isActive, hasProjectAccess, openDrawer]);
}

function DrawerContent() {
  useLayoutEffect(() => {
    return () => {
      SidebarPanelStore.hidePanel();
    };
  }, []);

  return <SidebarContent />;
}

/**
 * @deprecated Use useProfilingOnboardingDrawer instead.
 */
export function LegacyProfilingOnboardingSidebar(props: CommonSidebarProps) {
  if (props.currentPanel !== SidebarPanelKey.PROFILING_ONBOARDING) {
    return null;
  }

  return <ProfilingOnboarding {...props} />;
}

function ProfilingOnboarding(props: CommonSidebarProps) {
  return (
    <TaskSidebar
      orientation={props.orientation}
      collapsed={props.collapsed}
      hidePanel={() => {
        props.hidePanel();
      }}
    >
      <SidebarContent />
    </TaskSidebar>
  );
}

function SidebarContent() {
  const pageFilters = usePageFilters();
  const organization = useOrganization();
  const {projects} = useProjects();

  const [currentProject, setCurrentProject] = useState<Project | undefined>();

  const {supported: supportedProjects, unsupported: unsupportedProjects} = useMemo(
    () => splitProjectsByProfilingSupport(projects),
    [projects]
  );

  useEffect(() => {
    return () => {
      trackAnalytics('profiling_views.onboarding_action', {
        organization,
        action: 'dismissed',
      });
    };
  }, [organization]);

  useEffect(() => {
    if (currentProject) {
      return;
    }

    // we'll only ever select an unsupportedProject if they do not have a supported project in their organization
    if (supportedProjects.length === 0 && unsupportedProjects.length > 0) {
      if (pageFilters.selection.projects[0] === ALL_ACCESS_PROJECTS) {
        setCurrentProject(unsupportedProjects[0]);
        return;
      }

      setCurrentProject(
        // there's an edge case where an org w/ a single project may be unsupported but for whatever reason there is no project selection so we can't select a project
        // in those cases we'll simply default to the first unsupportedProject
        unsupportedProjects.find(
          p => p.id === String(pageFilters.selection.projects[0])
        ) ?? unsupportedProjects[0]
      );
      return;
    }
    // if it's My Projects or All Projects, pick the first supported project
    if (
      pageFilters.selection.projects.length === 0 ||
      pageFilters.selection.projects[0] === ALL_ACCESS_PROJECTS
    ) {
      setCurrentProject(supportedProjects[0]);
      return;
    }

    // if it's a list of projects, pick the first one that's supported
    const supportedProjectsById = supportedProjects.reduce((mapping, project) => {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      mapping[project.id] = project;
      return mapping;
    }, {});

    for (const projectId of pageFilters.selection.projects) {
      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      if (supportedProjectsById[String(projectId)]) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        setCurrentProject(supportedProjectsById[String(projectId)]);
        return;
      }
    }
  }, [
    currentProject,
    pageFilters.selection.projects,
    supportedProjects,
    unsupportedProjects,
  ]);

  const projectSelectOptions = useMemo(() => {
    const supportedProjectItems: Array<SelectValue<string>> = supportedProjects.map(
      project => {
        return {
          value: project.id,
          textValue: project.id,
          label: (
            <StyledIdBadge project={project} avatarSize={16} hideOverflow disableLink />
          ),
        };
      }
    );

    const unsupportedProjectItems: Array<SelectValue<string>> = unsupportedProjects.map(
      project => {
        return {
          value: project.id,
          textValue: project.id,
          label: (
            <StyledIdBadge project={project} avatarSize={16} hideOverflow disableLink />
          ),
          disabled: true,
        };
      }
    );
    return [
      {
        label: t('Supported'),
        options: supportedProjectItems,
      },
      {
        label: t('Unsupported'),
        options: unsupportedProjectItems,
      },
    ];
  }, [supportedProjects, unsupportedProjects]);

  const currentPlatform = currentProject?.platform
    ? platforms.find(p => p.id === currentProject.platform)
    : undefined;

  return (
    <Fragment>
      <Content>
        <Heading>{t('Profile Code')}</Heading>
        <div
          onClick={e => {
            // we need to stop bubbling the CompactSelect click event
            // failing to do so will cause the sidebar panel to close
            // the event.target will be unmounted by the time the panel listener
            // receives the event and assume the click was outside the panel
            e.stopPropagation();
          }}
        >
          <CompactSelect
            triggerLabel={
              currentProject ? (
                <StyledIdBadge
                  project={currentProject}
                  avatarSize={16}
                  hideOverflow
                  disableLink
                />
              ) : (
                t('Select a project')
              )
            }
            value={currentProject?.id}
            onChange={opt => setCurrentProject(projects.find(p => p.id === opt.value))}
            triggerProps={{'aria-label': currentProject?.slug}}
            options={projectSelectOptions}
            position="bottom-end"
          />
        </div>
        {currentProject && currentPlatform ? (
          <ProfilingOnboardingContent
            activeProductSelection={PROFILING_ONBOARDING_STEPS}
            organization={organization}
            platform={currentPlatform}
            projectId={currentProject.id}
            projectSlug={currentProject.slug}
          />
        ) : null}
      </Content>
    </Fragment>
  );
}

interface ProfilingOnboardingContentProps {
  activeProductSelection: ProductSolution[];
  organization: Organization;
  platform: PlatformIntegration;
  projectId: Project['id'];
  projectSlug: Project['slug'];
}

function ProfilingOnboardingContent(props: ProfilingOnboardingContentProps) {
  const api = useApi();
  const {isLoading, isError, dsn, docs, refetch, projectKeyId} = useLoadGettingStarted({
    orgSlug: props.organization.slug,
    projSlug: props.projectSlug,
    platform: props.platform,
  });
  const {isSelfHosted, urlPrefix} = useLegacyStore(ConfigStore);

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return (
      <LoadingError
        message={t(
          'We encountered an issue while loading the getting started documentation for this platform.'
        )}
      />
    );
  }

  if (!docs) {
    return (
      <LoadingError
        message={t(
          'The getting started documentation for this platform is currently unavailable.'
        )}
      />
    );
  }

  if (!dsn) {
    return (
      <LoadingError
        message={t(
          'We encountered an issue while loading the DSN for this getting started documentation.'
        )}
        onRetry={refetch}
      />
    );
  }

  if (!projectKeyId) {
    return (
      <LoadingError
        message={t(
          'We encountered an issue while loading the Client Key for this getting started documentation.'
        )}
        onRetry={refetch}
      />
    );
  }

  const docParams: DocsParams<any> = {
    api,
    projectKeyId,
    dsn,
    organization: props.organization,
    platformKey: props.platform.id,
    projectId: props.projectId,
    projectSlug: props.projectSlug,
    isFeedbackSelected: false,
    isPerformanceSelected: true,
    isProfilingSelected: true,
    isReplaySelected: false,
    sourcePackageRegistries: {
      isLoading: false,
      data: undefined,
    },
    platformOptions: PROFILING_ONBOARDING_STEPS,
    newOrg: false,
    feedbackOptions: {},
    /**
     * Page where the docs will be rendered
     */
    docsLocation: DocsPageLocation.PROFILING_PAGE,
    urlPrefix,
    isSelfHosted,
    profilingOptions: {
      defaultProfilingMode: props.organization.features.includes('continuous-profiling')
        ? 'continuous'
        : 'transaction',
    },
  };

  const doc = docs.profilingOnboarding ?? docs.onboarding;
  const steps = [...doc.install(docParams), ...doc.configure(docParams)];

  return (
    <Wrapper>
      {doc.introduction && <Introduction>{doc.introduction(docParams)}</Introduction>}
      <Steps>
        {steps.map(step => {
          return <Step key={step.title ?? step.type} {...step} />;
        })}
      </Steps>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  margin-top: ${space(2)};
`;

const Steps = styled('div')`
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const Introduction = styled('div')`
  & > p:not(:last-child) {
    margin-bottom: ${space(2)};
  }
`;

const Content = styled('div')`
  padding: ${space(2)};
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
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
