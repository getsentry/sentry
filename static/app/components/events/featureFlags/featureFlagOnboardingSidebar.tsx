import type {ReactNode} from 'react';
import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import HighlightTopRightPattern from 'sentry-images/pattern/highlight-top-right.svg';

import {LinkButton} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import {FeatureFlagOnboardingLayout} from 'sentry/components/events/featureFlags/featureFlagOnboardingLayout';
import {FeatureFlagOtherPlatformOnboarding} from 'sentry/components/events/featureFlags/featureFlagOtherPlatformOnboarding';
import {FLAG_HASH_SKIP_CONFIG} from 'sentry/components/events/featureFlags/useFeatureFlagOnboarding';
import {
  IntegrationOptions,
  ProviderOptions,
} from 'sentry/components/events/featureFlags/utils';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import IdBadge from 'sentry/components/idBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import useCurrentProjectState from 'sentry/components/onboarding/gettingStartedDoc/utils/useCurrentProjectState';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import SidebarPanel from 'sentry/components/sidebar/sidebarPanel';
import type {CommonSidebarProps} from 'sentry/components/sidebar/types';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import TextOverflow from 'sentry/components/textOverflow';
import {featureFlagOnboardingPlatforms} from 'sentry/data/platformCategories';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import useUrlParams from 'sentry/utils/useUrlParams';

function FeatureFlagOnboardingSidebar(props: CommonSidebarProps) {
  const {currentPanel, collapsed, hidePanel, orientation} = props;
  const organization = useOrganization();

  const isActive = currentPanel === SidebarPanelKey.FEATURE_FLAG_ONBOARDING;
  const hasProjectAccess = organization.access.includes('project:read');

  const {
    hasDocs,
    projects,
    allProjects,
    currentProject,
    setCurrentProject,
    supportedProjects,
    unsupportedProjects,
  } = useCurrentProjectState({
    currentPanel,
    targetPanel: SidebarPanelKey.FEATURE_FLAG_ONBOARDING,
    onboardingPlatforms: featureFlagOnboardingPlatforms,
    allPlatforms: featureFlagOnboardingPlatforms,
  });

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
        <Heading>{t('Debug Issues with Feature Flag Context')}</Heading>
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
        </HeaderActions>
        <OnboardingContent currentProject={selectedProject} hasDocs={hasDocs} />
      </TaskList>
    </TaskSidebarPanel>
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

  // useMemo is needed to remember the original hash
  // in case window.location.hash disappears
  const ORIGINAL_HASH = useMemo(() => {
    return window.location.hash;
  }, []);
  const skipConfig = ORIGINAL_HASH === FLAG_HASH_SKIP_CONFIG;
  const openFeatureProviders = Object.values(ProviderOptions);
  const sdkProviders = Object.values(ProviderOptions);

  // First dropdown: OpenFeature providers
  const openFeatureProviderOptions = openFeatureProviders.map(provider => {
    return {
      value: provider,
      textValue: provider,
      label: <TextOverflow>{provider}</TextOverflow>,
    };
  });

  const [openFeatureProvider, setOpenFeatureProvider] = useState<{
    value: string;
    label?: ReactNode;
    textValue?: string;
  }>(openFeatureProviderOptions[0]!);

  // Second dropdown: other SDK providers
  const sdkProviderOptions = sdkProviders.map(provider => {
    return {
      value: provider,
      textValue: provider,
      label: <TextOverflow>{provider}</TextOverflow>,
    };
  });

  const [sdkProvider, setsdkProvider] = useState<{
    value: string;
    label?: ReactNode;
    textValue?: string;
  }>(sdkProviderOptions[0]!);

  const defaultTab: string = 'openFeature';
  const {getParamValue: setupMode, setParamValue: setSetupMode} = useUrlParams(
    'mode',
    defaultTab
  );

  const currentPlatform = currentProject.platform
    ? platforms.find(p => p.id === currentProject.platform) ?? otherPlatform
    : otherPlatform;

  const {
    docs,
    dsn,
    isLoading: isProjKeysLoading,
    projectKeyId,
  } = useLoadGettingStarted({
    platform: currentPlatform,
    projSlug: currentProject.slug,
    orgSlug: organization.slug,
    productType: 'featureFlags',
  });

  const radioButtons = (
    <Header>
      <StyledRadioGroup
        label="mode"
        choices={[
          [
            'openFeature',
            <PlatformSelect key="platform-select">
              {tct('I use the OpenFeature SDK using a provider from [providerSelect]', {
                providerSelect: (
                  <CompactSelect
                    triggerLabel={openFeatureProvider.label}
                    value={openFeatureProvider.value}
                    onChange={setOpenFeatureProvider}
                    options={openFeatureProviderOptions}
                    position="bottom-end"
                    key={openFeatureProvider.textValue}
                    disabled={setupMode() === 'other'}
                  />
                ),
              })}
            </PlatformSelect>,
          ],
          [
            'other',
            <PlatformSelect key="platform-select">
              {tct('I use an SDK from [providerSelect]', {
                providerSelect: (
                  <CompactSelect
                    triggerLabel={sdkProvider.label}
                    value={sdkProvider.value}
                    onChange={setsdkProvider}
                    options={sdkProviderOptions}
                    position="bottom-end"
                    key={sdkProvider.textValue}
                    disabled={setupMode() === 'openFeature'}
                  />
                ),
              })}
            </PlatformSelect>,
          ],
        ]}
        value={setupMode()}
        onChange={value => {
          setSetupMode(value);
          window.location.hash = ORIGINAL_HASH;
        }}
      />
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

  const doesNotSupportFeatureFlags =
    !currentProject.platform ||
    !featureFlagOnboardingPlatforms.concat('other').includes(currentProject.platform);

  const defaultMessage = (
    <Fragment>
      <StyledDefaultContent>
        {t(
          'To see which feature flags changed over time, visit the settings page to set up a webhook for your Feature Flag provider.'
        )}
        <LinkButton size="sm" href={`/settings/${organization.slug}/feature-flags/`}>
          {t('Go to Feature Flag Settings')}
        </LinkButton>
      </StyledDefaultContent>
      <div>
        {tct(
          'Tracking flag evaluations is not supported for [platform] yet. It is currently available for Python and JavaScript projects through the Feature Flags SDK. You can [link:read the docs] to learn more.',
          {
            link: (
              <ExternalLink href="https://docs.sentry.io/product/explore/feature-flags/" />
            ),
            platform: currentPlatform?.name || currentProject.slug,
          }
        )}
      </div>
    </Fragment>
  );

  if (currentProject.platform === 'other') {
    return (
      <Fragment>
        {radioButtons}
        <FeatureFlagOtherPlatformOnboarding
          projectSlug={currentProject.slug}
          integration={
            // either OpenFeature or the SDK selected from the second dropdown
            setupMode() === 'openFeature'
              ? IntegrationOptions.OPENFEATURE
              : sdkProvider.value
          }
          provider={
            // dropdown value (from either dropdown)
            setupMode() === 'openFeature' ? openFeatureProvider.value : sdkProvider.value
          }
        />
      </Fragment>
    );
  }

  // Platform is not supported, no platform, docs import failed, no DSN, or the platform doesn't have onboarding yet
  if (
    doesNotSupportFeatureFlags ||
    !currentPlatform ||
    !docs ||
    !dsn ||
    !hasDocs ||
    !projectKeyId
  ) {
    return defaultMessage;
  }

  return (
    <Fragment>
      {radioButtons}
      <FeatureFlagOnboardingLayout
        skipConfig={skipConfig}
        docsConfig={docs}
        dsn={dsn}
        projectKeyId={projectKeyId}
        activeProductSelection={[]}
        platformKey={currentPlatform.id}
        projectId={currentProject.id}
        projectSlug={currentProject.slug}
        integration={
          // either OpenFeature or the SDK selected from the second dropdown
          setupMode() === 'openFeature'
            ? IntegrationOptions.OPENFEATURE
            : sdkProvider.value
        }
        provider={
          // dropdown value (from either dropdown)
          setupMode() === 'openFeature' ? openFeatureProvider.value : sdkProvider.value
        }
        configType="featureFlagOnboarding"
      />
    </Fragment>
  );
}

const StyledDefaultContent = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${space(2)};
  margin: ${space(1)} 0;
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
  font-weight: ${p => p.theme.fontWeightBold};
  line-height: 1;
  margin-top: ${space(3)};
`;

const StyledIdBadge = styled(IdBadge)`
  overflow: hidden;
  white-space: nowrap;
  flex-shrink: 1;
`;

const HeaderActions = styled('div')`
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: ${space(3)};
`;

const PlatformSelect = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
  flex-wrap: wrap;
`;

const StyledRadioGroup = styled(RadioGroup)`
  padding: ${space(1)} 0;
`;

const Header = styled('div')`
  padding: ${space(1)} 0;
`;

export default FeatureFlagOnboardingSidebar;
