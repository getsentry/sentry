import type {ReactNode} from 'react';
import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import HighlightTopRightPattern from 'sentry-images/pattern/highlight-top-right.svg';

import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import useDrawer from 'sentry/components/globalDrawer';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import useCurrentProjectState from 'sentry/components/onboarding/gettingStartedDoc/utils/useCurrentProjectState';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import {PlatformOptionDropdown} from 'sentry/components/onboarding/platformOptionDropdown';
import {pickPlatformOptions} from 'sentry/components/replaysOnboarding/pickPlatformOptions';
import {ReplayOnboardingLayout} from 'sentry/components/replaysOnboarding/replayOnboardingLayout';
import {replayJsFrameworkOptions} from 'sentry/components/replaysOnboarding/utils';
import TextOverflow from 'sentry/components/textOverflow';
import {
  replayBackendPlatforms,
  replayFrontendPlatforms,
  replayJsLoaderInstructionsPlatformList,
  replayMobilePlatforms,
  replayOnboardingPlatforms,
  replayPlatforms,
} from 'sentry/data/platformCategories';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import OnboardingDrawerStore, {
  OnboardingDrawerKey,
} from 'sentry/stores/onboardingDrawerStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import type {PlatformKey, Project} from 'sentry/types/project';
import useUrlParams from 'sentry/utils/url/useUrlParams';
import useOrganization from 'sentry/utils/useOrganization';

export function useReplaysOnboardingDrawer() {
  const organization = useOrganization();
  const currentPanel = useLegacyStore(OnboardingDrawerStore);
  const isActive = currentPanel === OnboardingDrawerKey.REPLAYS_ONBOARDING;
  const hasProjectAccess = organization.access.includes('project:read');

  const {openDrawer} = useDrawer();

  useEffect(() => {
    if (isActive && hasProjectAccess) {
      openDrawer(() => <DrawerContent />, {
        ariaLabel: t('Getting Started with Session Replay'),
        // Prevent the drawer from closing when the query params change
        shouldCloseOnLocationChange: location =>
          location.pathname !== window.location.pathname,
      });
    }
  }, [isActive, hasProjectAccess, openDrawer]);
}

function DrawerContent() {
  useEffect(() => {
    return () => {
      OnboardingDrawerStore.close();
    };
  }, []);

  return <SidebarContent />;
}

function SidebarContent() {
  const {
    hasDocs,
    projects,
    allProjects,
    currentProject,
    setCurrentProject,
    supportedProjects,
    unsupportedProjects,
  } = useCurrentProjectState({
    currentPanel: OnboardingDrawerKey.REPLAYS_ONBOARDING,
    targetPanel: OnboardingDrawerKey.REPLAYS_ONBOARDING,
    onboardingPlatforms: replayOnboardingPlatforms,
    allPlatforms: replayPlatforms,
  });

  const projectSelectOptions = useMemo(() => {
    const supportedProjectItems: Array<SelectValue<string>> = supportedProjects
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

  const selectedProject = currentProject ?? projects[0] ?? allProjects[0];

  if (!selectedProject) {
    return null;
  }

  return (
    <Fragment>
      <TopRightBackgroundImage src={HighlightTopRightPattern} />
      <TaskList>
        <Heading>{t('Getting Started with Session Replay')}</Heading>
        <Flex direction="row" justify="between" gap="2xl">
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
              value={currentProject?.id}
              onChange={opt =>
                setCurrentProject(allProjects.find(p => p.id === opt.value))
              }
              trigger={triggerProps => (
                <OverlayTrigger.Button
                  {...triggerProps}
                  aria-label={currentProject?.slug}
                >
                  {currentProject ? (
                    <StyledIdBadge
                      project={currentProject}
                      avatarSize={16}
                      hideOverflow
                      disableLink
                    />
                  ) : (
                    t('Select a project')
                  )}
                </OverlayTrigger.Button>
              )}
              options={projectSelectOptions}
              position="bottom-end"
            />
          </div>
        </Flex>
        <OnboardingContent currentProject={selectedProject} hasDocs={hasDocs} />
      </TaskList>
    </Fragment>
  );
}

function OnboardingContent({
  currentProject,
  hasDocs,
}: {
  currentProject: Project;
  hasDocs: boolean;
}) {
  const organization = useOrganization();

  const jsFrameworkSelectOptions = replayJsFrameworkOptions().map(platform => {
    return {
      value: platform.id,
      textValue: platform.name,
      label: (
        <Flex gap="md" align="center">
          <PlatformIcon platform={platform.id} size={16} />
          <TextOverflow>{platform.name}</TextOverflow>
        </Flex>
      ),
    };
  });

  const [jsFramework, setJsFramework] = useState<{
    value: PlatformKey;
    label?: ReactNode;
    textValue?: string;
  }>(jsFrameworkSelectOptions[0]!);

  const backendPlatform =
    currentProject.platform && replayBackendPlatforms.includes(currentProject.platform);
  const mobilePlatform =
    currentProject.platform && replayMobilePlatforms.includes(currentProject.platform);
  const npmOnlyFramework =
    currentProject.platform &&
    replayFrontendPlatforms
      .filter((p): p is PlatformKey => p !== 'javascript')
      .includes(currentProject.platform);

  const defaultTab = 'jsLoader';
  const {getParamValue: setupMode, setParamValue: setSetupMode} = useUrlParams(
    'mode',
    defaultTab
  );

  const showJsFrameworkInstructions = backendPlatform && setupMode() === 'npm';

  const currentPlatform = currentProject.platform
    ? (platforms.find(p => p.id === currentProject.platform) ?? otherPlatform)
    : otherPlatform;

  // New onboarding docs
  const {
    docs,
    dsn,
    isLoading: isProjKeysLoading,
    projectKeyId,
  } = useLoadGettingStarted({
    platform:
      showJsFrameworkInstructions && setupMode() === 'npm'
        ? (replayJsFrameworkOptions().find(p => p.id === jsFramework.value) ??
          replayJsFrameworkOptions()[0]!)
        : currentPlatform,
    projSlug: currentProject.slug,
    orgSlug: organization.slug,
    productType: 'replay',
  });

  // New onboarding docs for initial loading of JS Framework options
  const {docs: jsFrameworkDocs} = useLoadGettingStarted({
    platform:
      replayJsFrameworkOptions().find(p => p.id === jsFramework.value) ??
      replayJsFrameworkOptions()[0]!,
    projSlug: currentProject.slug,
    orgSlug: organization.slug,
    productType: 'replay',
  });

  const showRadioButtons =
    currentProject.platform &&
    replayJsLoaderInstructionsPlatformList.includes(currentProject.platform);

  const radioButtons = (
    <Header>
      {showRadioButtons ? (
        <StyledRadioGroup
          label="mode"
          choices={[
            [
              'npm',
              backendPlatform ? (
                <Flex gap="md" align="center" wrap="wrap" key="platform-select">
                  {tct('I use [platformSelect]', {
                    platformSelect: (
                      <CompactSelect
                        size="xs"
                        trigger={triggerProps => (
                          <OverlayTrigger.Button {...triggerProps}>
                            {jsFramework.label ?? triggerProps.children}
                          </OverlayTrigger.Button>
                        )}
                        value={jsFramework.value}
                        onChange={setJsFramework}
                        options={jsFrameworkSelectOptions}
                        position="bottom-end"
                        key={jsFramework.textValue}
                        disabled={setupMode() === 'jsLoader'}
                      />
                    ),
                  })}
                  {jsFrameworkDocs?.platformOptions && (
                    <PlatformOptionDropdown
                      platformOptions={jsFrameworkDocs?.platformOptions}
                      disabled={setupMode() === 'jsLoader'}
                    />
                  )}
                </Flex>
              ) : (
                t('I use NPM or Yarn')
              ),
            ],
            ['jsLoader', t('I use HTML templates (Loader Script)')],
          ]}
          value={setupMode()}
          onChange={setSetupMode}
        />
      ) : (
        !mobilePlatform &&
        (docs?.platformOptions?.siblingOption || docs?.platformOptions?.packageManager) &&
        !isProjKeysLoading && (
          <Flex gap="md" align="center" wrap="wrap">
            {tct("I'm using [platformSelect]", {
              platformSelect: (
                <PlatformOptionDropdown
                  platformOptions={pickPlatformOptions(docs?.platformOptions)}
                />
              ),
            })}
          </Flex>
        )
      )}
    </Header>
  );

  if (isProjKeysLoading) {
    return (
      <Fragment>
        {radioButtons}
        <LoadingIndicator />
      </Fragment>
    );
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
          <LinkButton
            size="sm"
            href="https://docs.sentry.io/platforms/javascript/session-replay/"
            external
          >
            {t('Go to Sentry Documentation')}
          </LinkButton>
        </div>
      </Fragment>
    );
  }

  // No platform, docs import failed, no DSN, ingestion is turned off, or the platform doesn't have onboarding yet
  if (
    !currentPlatform ||
    !docs ||
    !dsn ||
    !hasDocs ||
    !projectKeyId ||
    organization.features.includes('session-replay-video-disabled')
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
          <LinkButton
            size="sm"
            href="https://docs.sentry.io/platforms/javascript/session-replay/"
            external
          >
            {t('Read Docs')}
          </LinkButton>
        </div>
      </Fragment>
    );
  }

  return (
    <Fragment>
      {radioButtons}
      <ReplayOnboardingLayout
        hideMaskBlockToggles={mobilePlatform}
        docsConfig={docs}
        dsn={dsn}
        projectKeyId={projectKeyId}
        activeProductSelection={[]}
        platformKey={currentPlatform.id}
        project={currentProject}
        configType={
          setupMode() === 'npm' || // switched to NPM option
          npmOnlyFramework ||
          mobilePlatform // even if '?mode=jsLoader', only show npm/default instructions for FE frameworks & mobile platforms
            ? 'replayOnboarding'
            : 'replayOnboardingJsLoader'
        }
      />
    </Fragment>
  );
}

const Header = styled('div')`
  padding: ${space(1)} 0;
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
  color: ${p => p.theme.tokens.interactive.link.accent.rest};
  font-size: ${p => p.theme.fontSize.xs};
  text-transform: uppercase;
  font-weight: ${p => p.theme.fontWeight.bold};
  line-height: 1;
  margin-top: ${space(3)};
`;

const StyledIdBadge = styled(IdBadge)`
  overflow: hidden;
  white-space: nowrap;
  flex-shrink: 1;
`;

const StyledRadioGroup = styled(RadioGroup)`
  padding: ${space(1)} 0;
`;
