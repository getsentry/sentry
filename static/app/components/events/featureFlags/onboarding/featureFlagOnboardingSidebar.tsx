import type {ReactNode} from 'react';
import {Fragment, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

import HighlightTopRightPattern from 'sentry-images/pattern/highlight-top-right.svg';

import {Flex, Stack} from '@sentry/scraps/layout';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {ExternalLink} from 'sentry/components/core/link';
import {FeatureFlagOnboardingLayout} from 'sentry/components/events/featureFlags/onboarding/featureFlagOnboardingLayout';
import {FeatureFlagOtherPlatformOnboarding} from 'sentry/components/events/featureFlags/onboarding/featureFlagOtherPlatformOnboarding';
import {SdkProviderEnum} from 'sentry/components/events/featureFlags/utils';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import useDrawer from 'sentry/components/globalDrawer';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import useCurrentProjectState from 'sentry/components/onboarding/gettingStartedDoc/utils/useCurrentProjectState';
import {useLoadGettingStarted} from 'sentry/components/onboarding/gettingStartedDoc/utils/useLoadGettingStarted';
import TextOverflow from 'sentry/components/textOverflow';
import {featureFlagOnboardingPlatforms} from 'sentry/data/platformCategories';
import platforms, {otherPlatform} from 'sentry/data/platforms';
import {t, tct} from 'sentry/locale';
import OnboardingDrawerStore, {
  OnboardingDrawerKey,
} from 'sentry/stores/onboardingDrawerStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import type {Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import useUrlParams from 'sentry/utils/url/useUrlParams';
import useOrganization from 'sentry/utils/useOrganization';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

export function useFeatureFlagOnboardingDrawer() {
  const organization = useOrganization();
  const currentPanel = useLegacyStore(OnboardingDrawerStore);
  const isActive = currentPanel === OnboardingDrawerKey.FEATURE_FLAG_ONBOARDING;
  const hasProjectAccess = organization.access.includes('project:read');
  const initialPathname = useRef<string | null>(null);

  const {openDrawer} = useDrawer();

  useEffect(() => {
    if (isActive && hasProjectAccess) {
      initialPathname.current = window.location.pathname;

      openDrawer(() => <SidebarContent />, {
        ariaLabel: t('Debug Issues with Feature Flag Context'),
        // Prevent the drawer from closing when the query params change
        shouldCloseOnLocationChange: location =>
          location.pathname !== initialPathname.current,
      });

      // Reset store
      OnboardingDrawerStore.close();
    }
  }, [isActive, hasProjectAccess, openDrawer]);
}

function SidebarContent() {
  const {
    allProjects,
    currentProject,
    setCurrentProject,
    supportedProjects,
    unsupportedProjects,
  } = useCurrentProjectState({
    currentPanel: OnboardingDrawerKey.FEATURE_FLAG_ONBOARDING,
    targetPanel: OnboardingDrawerKey.FEATURE_FLAG_ONBOARDING,
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

  const organization = useOrganization();

  return (
    <Fragment>
      <TopRightBackgroundImage src={HighlightTopRightPattern} />
      <TaskList>
        <Heading>{t('Debug Issues with Feature Flag Context')}</Heading>
        <Flex justify="between" gap="2xl">
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
              onChange={opt => {
                const newProject = allProjects.find(p => p.id === opt.value);
                setCurrentProject(newProject);
                trackAnalytics('flags.setup_sidebar_selection', {
                  organization,
                  platform: newProject?.platform,
                });
              }}
              triggerProps={{
                'aria-label': currentProject?.slug,
                children: currentProject ? (
                  <StyledIdBadge
                    project={currentProject}
                    avatarSize={16}
                    hideOverflow
                    disableLink
                  />
                ) : (
                  t('Select a project')
                ),
              }}
              options={projectSelectOptions}
              position="bottom-end"
            />
          </div>
        </Flex>
        {currentProject ? (
          <OnboardingContent currentProject={currentProject} />
        ) : (
          <TextBlock>
            {t('Select a project from the drop-down to view set up instructions.')}
          </TextBlock>
        )}
      </TaskList>
    </Fragment>
  );
}

function OnboardingContent({currentProject}: {currentProject: Project}) {
  const organization = useOrganization();

  // useMemo is needed to remember the original hash
  // in case window.location.hash disappears
  const ORIGINAL_HASH = useMemo(() => {
    return window.location.hash;
  }, []);

  const sdkProviderOptions = Object.values(SdkProviderEnum)
    .filter(provider => provider !== SdkProviderEnum.GENERIC)
    .map(provider => {
      return {
        value: provider,
        label: <TextOverflow>{provider}</TextOverflow>,
      };
    });

  const [sdkProvider, setsdkProvider] = useState<{
    value: SdkProviderEnum;
    label?: ReactNode;
  }>(sdkProviderOptions[0]!);

  const defaultTab = 'sdkSelect';
  const {getParamValue: setupMode, setParamValue: setSetupMode} = useUrlParams(
    'mode',
    defaultTab
  );

  const currentPlatform = currentProject.platform
    ? (platforms.find(p => p.id === currentProject.platform) ?? otherPlatform)
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

  const header = (
    <ContentHeader>
      <h3>{t('Set Up Evaluation Tracking')}</h3>
      <p>{t('Configure Sentry to track feature flag evaluations on error events.')}</p>
      <RadioGroup
        label="mode"
        choices={[
          [
            'sdkSelect',
            <Flex align="center" wrap="wrap" gap="md" key="sdkSelect">
              {tct('I use a Feature Flag SDK from [sdkSelect]', {
                sdkSelect: (
                  <CompactSelect
                    size="xs"
                    triggerProps={{children: sdkProvider.label}}
                    value={sdkProvider.value}
                    onChange={value => {
                      setsdkProvider(value);
                      trackAnalytics('flags.setup_sidebar_selection', {
                        organization,
                        platform: currentProject.platform,
                        provider: value.value,
                      });
                    }}
                    options={sdkProviderOptions}
                    position="bottom-end"
                    key={sdkProvider.value}
                    disabled={setupMode() === 'generic'}
                  />
                ),
              })}
            </Flex>,
          ],
          [
            'generic',
            <div key="generic">
              {t('I use a different solution to evaluate feature flags.')}
            </div>,
          ],
        ]}
        value={setupMode()}
        onChange={value => {
          setSetupMode(value);
          if (value === 'generic') {
            trackAnalytics('flags.setup_sidebar_selection', {
              organization,
              platform: currentProject.platform,
              provider: SdkProviderEnum.GENERIC,
            });
          }
          window.location.hash = ORIGINAL_HASH;
        }}
      />
    </ContentHeader>
  );

  if (isProjKeysLoading) {
    return (
      <Fragment>
        {header}
        <LoadingIndicator />
      </Fragment>
    );
  }

  const doesNotSupportFeatureFlags =
    !currentProject.platform ||
    !featureFlagOnboardingPlatforms.concat('other').includes(currentProject.platform);

  const defaultMessage = (
    <Fragment>
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
      <Stack align="start" margin="md 0" gap="xl">
        {t(
          'To see which feature flags changed over time, visit the settings page to set up a webhook for your Feature Flag provider.'
        )}
        <LinkButton
          size="sm"
          to={`/settings/${organization.slug}/feature-flags/change-tracking/`}
        >
          {t('Go to Feature Flag Settings')}
        </LinkButton>
      </Stack>
    </Fragment>
  );

  if (currentProject.platform === 'other') {
    return (
      <Fragment>
        {header}
        <FeatureFlagOtherPlatformOnboarding
          projectSlug={currentProject.slug}
          integration={
            setupMode() === 'generic' ? SdkProviderEnum.GENERIC : sdkProvider.value
          }
        />
      </Fragment>
    );
  }

  // Platform is not supported, no platform, docs import failed, no DSN, or the platform doesn't have onboarding yet
  if (doesNotSupportFeatureFlags || !currentPlatform || !docs || !dsn || !projectKeyId) {
    return defaultMessage;
  }

  return (
    <Fragment>
      {header}
      <FeatureFlagOnboardingLayout
        docsConfig={docs}
        dsn={dsn}
        projectKeyId={projectKeyId}
        activeProductSelection={[]}
        platformKey={currentPlatform.id}
        project={currentProject}
        integration={
          setupMode() === 'generic' ? SdkProviderEnum.GENERIC : sdkProvider.value
        }
        configType="featureFlagOnboarding"
      />
    </Fragment>
  );
}

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

const ContentHeader = styled('div')`
  padding: ${space(2)} 0;
`;
