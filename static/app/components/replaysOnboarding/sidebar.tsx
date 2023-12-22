import {Fragment, ReactNode, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import HighlightTopRightPattern from 'sentry-images/pattern/highlight-top-right.svg';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import useOnboardingDocs from 'sentry/components/onboardingWizard/useOnboardingDocs';
import {ReplayOnboardingLayout} from 'sentry/components/replaysOnboarding/replayOnboardingLayout';
import useCurrentProjectState from 'sentry/components/replaysOnboarding/useCurrentProjectState';
import useLoadOnboardingDoc from 'sentry/components/replaysOnboarding/useLoadOnboardingDoc';
import {
  generateDocKeys,
  isPlatformSupported,
  replayJsFrameworkOptions,
} from 'sentry/components/replaysOnboarding/utils';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {DocumentationWrapper} from 'sentry/components/sidebar/onboardingStep';
import SidebarPanel from 'sentry/components/sidebar/sidebarPanel';
import {CommonSidebarProps, SidebarPanelKey} from 'sentry/components/sidebar/types';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {
  backend,
  replayFrontendPlatforms,
  replayJsLoaderInstructionsPlatformList,
  replayPlatforms,
} from 'sentry/data/platformCategories';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import {PlatformKey, Project, SelectValue} from 'sentry/types';
import EventWaiter from 'sentry/utils/eventWaiter';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import usePrevious from 'sentry/utils/usePrevious';
import useUrlParams from 'sentry/utils/useUrlParams';

function ReplaysOnboardingSidebar(props: CommonSidebarProps) {
  const {currentPanel, collapsed, hidePanel, orientation} = props;
  const organization = useOrganization();

  const isActive = currentPanel === SidebarPanelKey.REPLAYS_ONBOARDING;
  const hasProjectAccess = organization.access.includes('project:read');

  const newOnboarding = organization.features.includes('session-replay-new-zero-state');

  const {
    projects,
    allProjects,
    currentProject,
    setCurrentProject,
    supportedProjects,
    unsupportedProjects,
  } = useCurrentProjectState({
    currentPanel,
  });

  const projectSelectOptions = useMemo(() => {
    const supportedProjectItems: SelectValue<string>[] = supportedProjects
      .sort((aProject, bProject) => {
        // if we're comparing two projects w/ or w/o replays alphabetical sort
        if (aProject.hasReplays === bProject.hasReplays) {
          return aProject.slug.localeCompare(bProject.slug);
        }
        // otherwise sort by whether or not they have replays
        return aProject.hasReplays ? 1 : -1;
      })
      .map(project => {
        return {
          value: project.id,
          textValue: project.id,
          label: (
            <StyledIdBadge project={project} avatarSize={16} hideOverflow disableLink />
          ),
        };
      });

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

  const showLoaderInstructions =
    currentProject &&
    currentProject.platform &&
    replayJsLoaderInstructionsPlatformList.includes(currentProject.platform);

  const defaultTab =
    currentProject && currentProject.platform && backend.includes(currentProject.platform)
      ? 'jsLoader'
      : 'npm';

  const {getParamValue: setupMode, setParamValue: setSetupMode} = useUrlParams(
    'mode',
    defaultTab
  );

  const selectedProject = currentProject ?? projects[0] ?? allProjects[0];
  if (!isActive || !hasProjectAccess || !selectedProject) {
    return null;
  }

  return (
    <TaskSidebarPanel
      orientation={orientation}
      collapsed={collapsed}
      hidePanel={hidePanel}
    >
      <TopRightBackgroundImage src={HighlightTopRightPattern} />
      <TaskList>
        <Heading>{t('Getting Started with Session Replay')}</Heading>
        <HeaderActions>
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
              onChange={opt =>
                setCurrentProject(allProjects.find(p => p.id === opt.value))
              }
              triggerProps={{'aria-label': currentProject?.slug}}
              options={projectSelectOptions}
              position="bottom-end"
            />
          </div>
          {newOnboarding && showLoaderInstructions && (
            <SegmentedControl
              size="md"
              aria-label={t('Change setup method')}
              value={setupMode()}
              onChange={setSetupMode}
            >
              <SegmentedControl.Item key="npm">
                <StyledTooltip title={t('I have a JS Framework')} showOnlyOnOverflow>
                  {t('I have a JS Framework')}
                </StyledTooltip>
              </SegmentedControl.Item>

              <SegmentedControl.Item key="jsLoader">
                <StyledTooltip title={t('I have an HTML Template')} showOnlyOnOverflow>
                  {t('I have an HTML Template')}
                </StyledTooltip>
              </SegmentedControl.Item>
            </SegmentedControl>
          )}
        </HeaderActions>
        <OnboardingContent currentProject={selectedProject} />
      </TaskList>
    </TaskSidebarPanel>
  );
}

function OnboardingContent({currentProject}: {currentProject: Project}) {
  const jsFrameworkSelectOptions = replayJsFrameworkOptions.map(platform => {
    return {
      value: platform.id,
      textValue: platform.name,
      label: (
        <PlatformLabel>
          <PlatformIcon platform={platform.id} size={16} />
          <TextOverflow>{platform.name}</TextOverflow>
        </PlatformLabel>
      ),
    };
  });

  const api = useApi();
  const organization = useOrganization();
  const previousProject = usePrevious(currentProject);
  const [received, setReceived] = useState<boolean>(false);
  const {getParamValue: setupMode} = useUrlParams('mode');
  const [jsFramework, setJsFramework] = useState<{
    value: PlatformKey;
    label?: ReactNode;
    textValue?: string;
  }>(jsFrameworkSelectOptions[0]);

  const newOnboarding = organization.features.includes('session-replay-new-zero-state');
  const showJsFrameworkInstructions =
    newOnboarding &&
    currentProject &&
    currentProject.platform &&
    backend.includes(currentProject.platform) &&
    setupMode() === 'npm';

  const defaultTab =
    currentProject && currentProject.platform && backend.includes(currentProject.platform)
      ? 'jsLoader'
      : 'npm';

  const npmOnlyFramework =
    currentProject &&
    currentProject.platform &&
    replayFrontendPlatforms
      .filter(p => p !== 'javascript')
      .includes(currentProject.platform);

  useEffect(() => {
    if (previousProject.id !== currentProject.id) {
      setReceived(false);
    }
  }, [previousProject.id, currentProject.id]);

  const currentPlatform = currentProject.platform
    ? platforms.find(p => p.id === currentProject.platform) ?? otherPlatform
    : otherPlatform;

  const docKeys = useMemo(() => {
    return currentPlatform && !newOnboarding ? generateDocKeys(currentPlatform.id) : [];
  }, [currentPlatform, newOnboarding]);

  // Old onboarding docs
  const {docContents, isLoading, hasOnboardingContents} = useOnboardingDocs({
    project: currentProject,
    docKeys,
    isPlatformSupported: isPlatformSupported(currentPlatform),
  });

  // New onboarding docs
  const {
    docs: newDocs,
    dsn,
    cdn,
    isProjKeysLoading,
  } = useLoadOnboardingDoc({
    platform: showJsFrameworkInstructions
      ? replayJsFrameworkOptions.find(p => p.id === jsFramework.value) ??
        replayJsFrameworkOptions[0]
      : currentPlatform,
    organization,
    projectSlug: currentProject.slug,
  });

  if (isLoading || isProjKeysLoading) {
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
          <Button
            size="sm"
            href="https://docs.sentry.io/platforms/javascript/session-replay/"
            external
          >
            {t('Go to Sentry Documentation')}
          </Button>
        </div>
      </Fragment>
    );
  }

  if (
    !currentPlatform ||
    (!newOnboarding && !hasOnboardingContents) ||
    (newOnboarding && !newDocs)
  ) {
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
      <IntroText>
        {tct(
          `Adding Session Replay to your [platform] project is simple. Make sure you've got these basics down.`,
          {platform: currentPlatform?.name || currentProject.slug}
        )}
        {showJsFrameworkInstructions ? (
          <PlatformSelect>
            {t('Select your JS Framework: ')}
            <CompactSelect
              triggerLabel={jsFramework.label}
              value={jsFramework.value}
              onChange={v => {
                setJsFramework(v);
              }}
              options={jsFrameworkSelectOptions}
              position="bottom-end"
            />
          </PlatformSelect>
        ) : null}
      </IntroText>
      {newOnboarding && newDocs ? (
        <ReplayOnboardingLayout
          docsConfig={newDocs}
          dsn={dsn}
          cdn={cdn}
          activeProductSelection={[]}
          platformKey={currentPlatform.id}
          projectId={currentProject.id}
          projectSlug={currentProject.slug}
          configType={
            setupMode() === 'npm' || // switched to NPM tab
            (!setupMode() && defaultTab === 'npm') || // default value for FE frameworks when ?mode={...} in URL is not set yet
            npmOnlyFramework // even if '?mode=jsLoader', only show npm instructions for FE frameworks
              ? 'replayOnboardingNpm'
              : 'replayOnboardingJsLoader'
          }
        />
      ) : (
        docKeys.map((docKey, index) => {
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
                {() =>
                  received ? <EventReceivedIndicator /> : <EventWaitingIndicator />
                }
              </EventWaiter>
            );
          }
          return (
            <div key={index}>
              <OnboardingStepV2 step={index + 1} content={docContents[docKey]} />
              {footer}
            </div>
          );
        })
      )}
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
    <OnboardingStepContainer>
      <div>
        <TaskStepNumber>{step}</TaskStepNumber>
      </div>
      <div>
        <DocumentationWrapper dangerouslySetInnerHTML={{__html: content}} />
      </div>
    </OnboardingStepContainer>
  );
}

const IntroText = styled('div')`
  padding-top: ${space(3)};
  display: grid;
  gap: ${space(1)};
`;

const OnboardingStepContainer = styled('div')`
  display: flex;
  & > :last-child {
    overflow: hidden;
  }
`;

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

const HeaderActions = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: ${space(3)};
`;

const StyledTooltip = styled(Tooltip)`
  ${p => p.theme.overflowEllipsis};
`;

const PlatformLabel = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

const PlatformSelect = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  padding-bottom: ${space(1)};
`;

export default ReplaysOnboardingSidebar;
