import React, {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import DropdownMenuControl from 'sentry/components/dropdownMenuControl';
import {MenuItemProps} from 'sentry/components/dropdownMenuItem';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import useOnboardingDocs from 'sentry/components/onboardingWizard/useOnboardingDocs';
import {
  DocumentationWrapper,
  OnboardingStep,
} from 'sentry/components/sidebar/onboardingStep';
import {TaskSidebar, TaskSidebarList} from 'sentry/components/sidebar/taskSidebar';
import {CommonSidebarProps, SidebarPanelKey} from 'sentry/components/sidebar/types';
import platforms from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';

import {
  makeDocKeyMap,
  splitProjectsByProfilingSupport,
  SupportedProfilingPlatform,
  supportedProfilingPlatforms,
} from './util';

export function ProfilingOnboardingSidebar(props: CommonSidebarProps) {
  const {currentPanel, collapsed, hidePanel, orientation} = props;
  const isActive = currentPanel === SidebarPanelKey.ProfilingOnboarding;
  const organization = useOrganization();
  const hasProjectAccess = organization.access.includes('project:read');

  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  const [currentProject, setCurrentProject] = useState<Project | undefined>(undefined);
  const pageFilters = usePageFilters();

  const {supported: supportedProjects} = useMemo(
    () => splitProjectsByProfilingSupport(projects),
    [projects]
  );

  useEffect(() => {
    if (!projects.length) {
      return;
    }
    const pageProjectSelectionId = pageFilters.selection.projects[0];
    const pageProjectSelection = projects.find(
      p => p.id === String(pageProjectSelectionId)
    );
    if (pageProjectSelection && supportedProjects.includes(pageProjectSelection)) {
      setCurrentProject(pageProjectSelection);
      return;
    }
    setCurrentProject(supportedProjects[0]);
  }, [projects, pageFilters.selection.projects, supportedProjects]);

  if (
    !isActive ||
    !hasProjectAccess ||
    !currentProject ||
    !projectsLoaded ||
    !projects ||
    projects.length === 0
  ) {
    return null;
  }

  const items: MenuItemProps[] = supportedProjects.map(project => {
    return {
      key: project.id,
      label: <StyledIdBadge project={project} avatarSize={16} hideOverflow disableLink />,
      onAction: function switchProject() {
        setCurrentProject(project);
      },
    };
  });

  return (
    <TaskSidebar orientation={orientation} collapsed={collapsed} hidePanel={hidePanel}>
      <TaskSidebarList>
        <Heading>{t('Profile Code')}</Heading>
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
      </TaskSidebarList>
    </TaskSidebar>
  );
}

function OnboardingContent({currentProject}: {currentProject: Project}) {
  const currentPlatform = platforms.find(p => p.id === currentProject.platform);

  // TODO: implement polling
  // usePollForFirstProfileEvent();

  const docKeysMap = useMemo(() => makeDocKeyMap(currentPlatform?.id), [currentPlatform]);

  const isPlatformSupported = useMemo(() => {
    if (!currentPlatform) {
      return false;
    }
    return supportedProfilingPlatforms.includes(
      // typescript being typescript
      currentPlatform.id as SupportedProfilingPlatform
    );
  }, [currentPlatform]);

  const {docContents, isLoading, hasOnboardingContents} = useOnboardingDocs({
    docKeys: docKeysMap ? Object.values(docKeysMap) : [],
    project: currentProject,
    isPlatformSupported,
  });

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (!isPlatformSupported) {
    return (
      <Fragment>
        <div>
          {tct(
            'Fiddlesticks. Profiling isn’t available for your [platform] project yet but we’re definitely still working on it. Stay tuned.',
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

  if (!currentPlatform || !docKeysMap || !hasOnboardingContents) {
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

  const alertContent = docContents[docKeysMap['0-alert']];

  return (
    <Fragment>
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

      {/* <EventWaitingIndicator /> */}
    </Fragment>
  );
}

// TODO: implement poll for first profile event
// function usePollForFirstProfileEvent() {
//   // TODO: implement polling on onboarding endpoint
// }

// const EventWaitingIndicator = () => (
//   <EventIndicator status="waiting">
//     {t("Waiting for this project's first profile")}
//   </EventIndicator>
// );

const Heading = styled('div')`
  display: flex;
  color: ${p => p.theme.purple300};
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
