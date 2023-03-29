import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import HighlightTopRightPattern from 'sentry-images/pattern/highlight-top-right.svg';

import {Button} from 'sentry/components/button';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import useOnboardingDocs from 'sentry/components/onboardingWizard/useOnboardingDocs';
// TODO: should be time to move this
import {Flex} from 'sentry/components/profiling/flex';
import useCurrentProjectState from 'sentry/components/replaysOnboarding/useCurrentProjectState';
import {
  generateDocKeys,
  isPlatformSupported,
} from 'sentry/components/replaysOnboarding/utils';
import {DocumentationWrapper} from 'sentry/components/sidebar/onboardingStep';
import SidebarPanel from 'sentry/components/sidebar/sidebarPanel';
import {CommonSidebarProps, SidebarPanelKey} from 'sentry/components/sidebar/types';
import {replayPlatforms} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import {Project} from 'sentry/types';
import EventWaiter from 'sentry/utils/eventWaiter';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';

function ReplaysOnboardingSidebar(props: CommonSidebarProps) {
  const {currentPanel, collapsed, hidePanel, orientation} = props;
  const organization = useOrganization();

  const isActive = currentPanel === SidebarPanelKey.ReplaysOnboarding;
  const hasProjectAccess = organization.access.includes('project:read');

  const {projects, allProjects, currentProject, setCurrentProject} =
    useCurrentProjectState({
      currentPanel,
    });

  const selectedProject = currentProject ?? projects[0] ?? allProjects[0];
  if (!isActive || !hasProjectAccess || !selectedProject) {
    return null;
  }

  const items: MenuItemProps[] = allProjects.reduce((acc: MenuItemProps[], project) => {
    const itemProps: MenuItemProps = {
      key: project.id,
      label: <StyledIdBadge project={project} avatarSize={16} hideOverflow disableLink />,
      onAction: () => setCurrentProject(project),
    };

    acc.push(itemProps);

    return acc;
  }, []);

  return (
    <TaskSidebarPanel
      orientation={orientation}
      collapsed={collapsed}
      hidePanel={hidePanel}
    >
      <TopRightBackgroundImage src={HighlightTopRightPattern} />
      <TaskList>
        <Heading>{t('Getting Started with Session Replay')}</Heading>
        <DropdownMenu
          items={items}
          triggerLabel={
            <StyledIdBadge
              project={selectedProject}
              avatarSize={16}
              hideOverflow
              disableLink
            />
          }
          triggerProps={{'aria-label': selectedProject.slug}}
          position="bottom-end"
        />
        <OnboardingContent currentProject={selectedProject} />
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

  const doesNotSupportReplay = currentProject.platform
    ? !replayPlatforms.includes(currentProject.platform)
    : true;

  if (doesNotSupportReplay) {
    return (
      <Fragment>
        <div>
          {tct(
            'Session Replay isn’t available for your [platform] project. It supports all browser JavaScript applications. It is built to work with @sentry/browser and our browser framework SDKs.',
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
            href="https://docs.sentry.io/platforms/javascript/session-replay/"
            external
          >
            {t('Read Docs')}
          </Button>
        </div>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <div>
        {tct(
          `Adding Session Replay to your [platform] project is simple. Make sure you've got these basics down.`,
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
              eventType="replay"
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
            <OnboardingStepV2 step={index + 1} content={docContents[docKey]} />
            {footer}
          </div>
        );
      })}
    </Fragment>
  );
}

// TODO: we'll have to move this into a folder for common consumption w/ Profiling, Performance etc.
interface OnboardingStepV2Props {
  content: string;
  step: number;
}

function OnboardingStepV2({step, content}: OnboardingStepV2Props) {
  return (
    <Flex>
      <div>
        <TaskStepNumber>{step}</TaskStepNumber>
      </div>
      <Flex.Item>
        <DocumentationWrapper dangerouslySetInnerHTML={{__html: content}} />
      </Flex.Item>
    </Flex>
  );
}

const TaskStepNumber = styled('div')`
  display: flex;
  margin-right: ${space(1.5)};
  background-color: ${p => p.theme.yellow300};
  border-radius: 50%;
  font-weight: bold;
  height: ${space(4)};
  width: ${space(4)};
  justify-content: center;
  align-items: center;
`;

const TaskSidebarPanel = styled(SidebarPanel)`
  width: 600px;
  max-width: 100%;
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
    {t("Waiting for this project's first user session")}
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
    {t("We've received this project's first user session!")}
  </div>
))`
  display: flex;
  align-items: center;
  flex-grow: 1;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.successText};
`;

export default ReplaysOnboardingSidebar;
