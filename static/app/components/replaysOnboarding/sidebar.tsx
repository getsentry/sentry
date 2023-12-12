import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import HighlightTopRightPattern from 'sentry-images/pattern/highlight-top-right.svg';

import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {SdkDocumentation} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import useOnboardingDocs from 'sentry/components/onboardingWizard/useOnboardingDocs';
import useCurrentProjectState from 'sentry/components/replaysOnboarding/useCurrentProjectState';
import {
  generateDocKeys,
  isPlatformSupported,
} from 'sentry/components/replaysOnboarding/utils';
import {SegmentedControl} from 'sentry/components/segmentedControl';
import {DocumentationWrapper} from 'sentry/components/sidebar/onboardingStep';
import SidebarPanel from 'sentry/components/sidebar/sidebarPanel';
import {CommonSidebarProps, SidebarPanelKey} from 'sentry/components/sidebar/types';
import {Tooltip} from 'sentry/components/tooltip';
import {replayPlatforms, replayPlatformsLoader} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';
import {Project, SelectValue} from 'sentry/types';
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

  const {getParamValue: setupMode, setParamValue: setSetupMode} = useUrlParams(
    'mode',
    'npm' // this default  needs to be changed later. for backend platforms, should default to jsLoader
  );

  const selectedProject = currentProject ?? projects[0] ?? allProjects[0];
  if (!isActive || !hasProjectAccess || !selectedProject) {
    return null;
  }

  const showLoaderInstructions =
    currentProject &&
    currentProject.platform &&
    replayPlatformsLoader.includes(currentProject.platform);

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
  const api = useApi();
  const organization = useOrganization();
  const previousProject = usePrevious(currentProject);
  const [received, setReceived] = useState<boolean>(false);
  const {getParamValue: setupMode} = useUrlParams('mode');

  useEffect(() => {
    if (previousProject.id !== currentProject.id) {
      setReceived(false);
    }
  }, [previousProject.id, currentProject.id]);

  const currentPlatform = currentProject.platform
    ? platforms.find(p => p.id === currentProject.platform)
    : undefined;

  const docKeys = useMemo(() => {
    return currentPlatform ? generateDocKeys(currentPlatform.id) : [];
  }, [currentPlatform]);

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

  const migrated = [
    'javascript',
    'javascript-react',
    'javascript-ember',
    'javascript-sveltekit',
    'javascript-svelte',
    'javascript-astro',
    'javascript-nextjs',
    'javascript-remix',
    'javascript-gatsby',
    'electron',
  ];
  const newOnboarding = organization.features.includes('session-replay-new-zero-state');
  const showNewOnboardingUI = newOnboarding && migrated.includes(currentPlatform.id);

  return (
    <Fragment>
      <IntroText>
        {tct(
          `Adding Session Replay to your [platform] project is simple. Make sure you've got these basics down.`,
          {platform: currentPlatform?.name || currentProject.slug}
        )}
      </IntroText>
      {showNewOnboardingUI ? (
        <SdkDocumentation
          platform={currentPlatform}
          organization={organization}
          projectSlug={currentProject.slug}
          projectId={currentProject.id}
          activeProductSelection={[]}
          configType={
            setupMode() === 'jsLoader'
              ? 'replayOnboardingJsLoader'
              : 'replayOnboardingNpm'
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

export default ReplaysOnboardingSidebar;
