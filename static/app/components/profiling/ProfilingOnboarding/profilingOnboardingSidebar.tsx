import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import useOnboardingDocs from 'sentry/components/onboardingWizard/useOnboardingDocs';
import {
  DocumentationWrapper,
  OnboardingStep,
} from 'sentry/components/sidebar/onboardingStep';
import {
  EventIndicator,
  TaskSidebar,
  TaskSidebarList,
} from 'sentry/components/sidebar/taskSidebar';
import {CommonSidebarProps, SidebarPanelKey} from 'sentry/components/sidebar/types';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import platforms from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Project, SelectValue} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventWaiter from 'sentry/utils/eventWaiter';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import usePrevious from 'sentry/utils/usePrevious';
import useProjects from 'sentry/utils/useProjects';

import {makeDocKeyMap, splitProjectsByProfilingSupport} from './util';

export function ProfilingOnboardingSidebar(props: CommonSidebarProps) {
  const {currentPanel, collapsed, hidePanel, orientation} = props;
  const isActive = currentPanel === SidebarPanelKey.PROFILING_ONBOARDING;
  const organization = useOrganization();
  const hasProjectAccess = organization.access.includes('project:read');

  const {projects} = useProjects();

  const [currentProject, setCurrentProject] = useState<Project | undefined>();
  const pageFilters = usePageFilters();

  const {supported: supportedProjects, unsupported: unsupportedProjects} = useMemo(
    () => splitProjectsByProfilingSupport(projects),
    [projects]
  );

  useEffect(() => {
    // If we already picked a project, don't do anything
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
      mapping[project.id] = project;
      return mapping;
    }, {});

    for (const projectId of pageFilters.selection.projects) {
      if (supportedProjectsById[String(projectId)]) {
        setCurrentProject(supportedProjectsById[String(projectId)]);
        return;
      }
    }
  }, [
    pageFilters.selection.projects,
    currentProject,
    supportedProjects,
    unsupportedProjects,
  ]);

  const projectSelectOptions = useMemo(() => {
    const supportedProjectItems: SelectValue<string>[] = supportedProjects.map(
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

    const unsupportedProjectItems: SelectValue<string>[] = unsupportedProjects.map(
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

  if (!isActive || !hasProjectAccess) {
    return null;
  }

  return (
    <TaskSidebar
      orientation={orientation}
      collapsed={collapsed}
      hidePanel={() => {
        trackAnalytics('profiling_views.onboarding_action', {
          organization,
          action: 'dismissed',
        });
        hidePanel();
      }}
    >
      <TaskSidebarList>
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
        {currentProject && (
          <OnboardingContent
            currentProject={currentProject}
            isSupported={supportedProjects.includes(currentProject)}
          />
        )}
      </TaskSidebarList>
    </TaskSidebar>
  );
}

function OnboardingContent({
  currentProject,
  isSupported,
}: {
  currentProject: Project;
  isSupported: boolean;
}) {
  const currentPlatform = platforms.find(p => p.id === currentProject?.platform);
  const api = useApi();
  const organization = useOrganization();
  const [received, setReceived] = useState(false);
  const previousProject = usePrevious(currentProject);
  useEffect(() => {
    if (!currentProject || !previousProject) {
      return;
    }
    if (previousProject.id !== currentProject.id) {
      setReceived(false);
    }
  }, [currentProject, previousProject]);

  const docKeysMap = useMemo(() => makeDocKeyMap(currentPlatform?.id), [currentPlatform]);
  const docKeys = useMemo(
    () => (docKeysMap ? Object.values(docKeysMap) : []),
    [docKeysMap]
  );

  const {docContents, isLoading, hasOnboardingContents} = useOnboardingDocs({
    docKeys,
    project: currentProject,
    isPlatformSupported: isSupported,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (!currentPlatform) {
    return (
      <ContentContainer>
        <p>
          {t(
            `Your project's platform has not been set. Please select your project's platform before proceeding.`
          )}
        </p>
        <Button
          size="sm"
          to={`/settings/${organization.slug}/projects/${currentProject.slug}/`}
        >
          {t('Go to Project Settings')}
        </Button>
      </ContentContainer>
    );
  }

  if (!isSupported) {
    // this content will only be presented if the org only has one project and its not supported
    // in these scenarios we will auto-select the unsupported project and render this message
    return (
      <ContentContainer>
        <p>
          {tct(
            'Fiddlesticks. Profiling isn’t available for your [platform] project yet. Reach out to us on Discord for more information.',
            {platform: currentPlatform?.name || currentProject.slug}
          )}
        </p>
        <Button size="sm" href="https://discord.gg/zrMjKA4Vnz" external>
          {t('Join Discord')}
        </Button>
      </ContentContainer>
    );
  }

  if (!docKeysMap || !hasOnboardingContents) {
    return (
      <ContentContainer>
        <p>
          {tct(
            'Fiddlesticks. This checklist isn’t available for your [project] project yet, but for now, go to Sentry docs for installation details.',
            {project: currentProject.slug}
          )}
        </p>
        <Button
          size="sm"
          href="https://docs.sentry.io/product/profiling/getting-started/"
          external
        >
          {t('Go to documentation')}
        </Button>
      </ContentContainer>
    );
  }

  const alertContent = docContents[docKeysMap['0-alert']];

  return (
    <ContentContainer>
      {alertContent && (
        <DocumentationWrapper dangerouslySetInnerHTML={{__html: alertContent}} />
      )}
      <p>
        {t(
          `Adding Profiling to your %s project is simple. Make sure you've got these basics down.`,
          currentPlatform!.name
        )}
      </p>
      {Object.entries(docKeysMap).map(entry => {
        const [key, docKey] = entry;
        if (key === '0-alert') {
          return null;
        }

        const content = docContents[docKey];
        if (!content) {
          return null;
        }
        return (
          <div key={docKey}>
            <OnboardingStep
              prefix="profiling"
              docKey={docKey}
              project={currentProject}
              docContent={content}
            />
          </div>
        );
      })}
      <EventWaiter
        api={api}
        organization={organization}
        project={currentProject}
        eventType="profile"
        onIssueReceived={() => {
          trackAnalytics('profiling_views.onboarding_action', {
            organization,
            action: 'done',
          });
          setReceived(true);
        }}
      >
        {() => (received ? <EventReceivedIndicator /> : <EventWaitingIndicator />)}
      </EventWaiter>
    </ContentContainer>
  );
}

function EventReceivedIndicator() {
  return (
    <EventIndicator status="received">
      {t("We've received this project's first profile!")}
    </EventIndicator>
  );
}

function EventWaitingIndicator() {
  return (
    <EventIndicator status="waiting">
      {t("Waiting for this project's first profile.")}
    </EventIndicator>
  );
}

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

const ContentContainer = styled('div')`
  margin: ${space(2)} 0;
`;
