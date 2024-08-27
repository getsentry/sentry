import {Fragment, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import {LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import NotFound from 'sentry/components/errors/notFound';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {SdkDocumentation} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import type {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {platformProductAvailability} from 'sentry/components/onboarding/productSelection';
import {
  performance as performancePlatforms,
  replayPlatforms,
} from 'sentry/data/platformCategories';
import type {Platform} from 'sentry/data/platformPickerCategories';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {IssueAlertRule} from 'sentry/types/alerts';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {PlatformIntegration, PlatformKey, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {SetupDocsLoader} from 'sentry/views/onboarding/setupDocsLoader';
import {GettingStartedWithProjectContext} from 'sentry/views/projects/gettingStartedWithProjectContext';

import {OtherPlatformsInfo} from './otherPlatformsInfo';
import {PlatformDocHeader} from './platformDocHeader';

const ProductUnavailableCTAHook = HookOrDefault({
  hookName: 'component:product-unavailable-cta',
});

type Props = {
  currentPlatformKey: PlatformKey;
  loading: boolean;
  platform: PlatformIntegration | undefined;
  project: Project | undefined;
};

export function ProjectInstallPlatform({
  loading,
  project,
  currentPlatformKey,
  platform: currentPlatform,
}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const gettingStartedWithProjectContext = useContext(GettingStartedWithProjectContext);

  const isSelfHosted = ConfigStore.get('isSelfHosted');
  const isSelfHostedErrorsOnly = ConfigStore.get('isSelfHostedErrorsOnly');

  const [showLoaderOnboarding, setShowLoaderOnboarding] = useState(
    currentPlatform?.id === 'javascript'
  );

  const products = useMemo(
    () => decodeList(location.query.product ?? []) as ProductSolution[],
    [location.query.product]
  );

  const {
    data: projectAlertRules,
    isPending: projectAlertRulesIsLoading,
    isError: projectAlertRulesIsError,
  } = useApiQuery<IssueAlertRule[]>(
    [`/projects/${organization.slug}/${project?.slug}/rules/`],
    {
      enabled: !!project?.slug,
      staleTime: 0,
    }
  );

  useEffect(() => {
    setShowLoaderOnboarding(currentPlatform?.id === 'javascript');
  }, [currentPlatform?.id]);

  useEffect(() => {
    if (!project || projectAlertRulesIsLoading || projectAlertRulesIsError) {
      return;
    }

    if (gettingStartedWithProjectContext.project?.id === project.id) {
      return;
    }

    const platformKey = Object.keys(platforms).find(
      key => platforms[key].id === project.platform
    );

    if (!platformKey) {
      return;
    }

    gettingStartedWithProjectContext.setProject({
      id: project.id,
      name: project.name,
      // sometimes the team slug here can be undefined
      teamSlug: project.team?.slug,
      alertRules: projectAlertRules,
      platform: {
        ...omit(platforms[platformKey], 'id'),
        key: platforms[platformKey].id,
      } as OnboardingSelectedSDK,
    });
  }, [
    gettingStartedWithProjectContext,
    project,
    projectAlertRules,
    projectAlertRulesIsLoading,
    projectAlertRulesIsError,
  ]);

  const platform: Platform = {
    key: currentPlatformKey,
    id: currentPlatform?.id,
    name: currentPlatform?.name,
    link: currentPlatform?.link,
  };

  const hideLoaderOnboarding = useCallback(() => {
    setShowLoaderOnboarding(false);

    if (!project?.id || !currentPlatform) {
      return;
    }

    trackAnalytics('onboarding.js_loader_npm_docs_shown', {
      organization,
      platform: currentPlatform.id,
      project_id: project?.id,
    });
  }, [organization, currentPlatform, project?.id]);

  if (!project) {
    return null;
  }

  if (!platform.id && platform.key !== 'other') {
    return <NotFound />;
  }

  // because we fall back to 'other' this will always be defined
  if (!currentPlatform) {
    return null;
  }

  const issueStreamLink = `/organizations/${organization.slug}/issues/`;
  const performanceOverviewLink = `/organizations/${organization.slug}/performance/`;
  const replayLink = `/organizations/${organization.slug}/replays/`;
  const showPerformancePrompt = performancePlatforms.includes(platform.id as PlatformKey);
  const showReplayButton = replayPlatforms.includes(platform.id as PlatformKey);
  const isGettingStarted = window.location.href.indexOf('getting-started') > 0;
  const showDocsWithProductSelection =
    (platformProductAvailability[platform.key] ?? []).length > 0;

  return (
    <Fragment>
      {!isSelfHosted && showDocsWithProductSelection && (
        <ProductUnavailableCTAHook organization={organization} />
      )}
      <PlatformDocHeader projectSlug={project.slug} platform={platform} />
      {platform.key === 'other' ? (
        <OtherPlatformsInfo
          projectSlug={project.slug}
          platform={platform.name ?? 'other'}
        />
      ) : showLoaderOnboarding ? (
        <SetupDocsLoader
          organization={organization}
          project={project}
          location={location}
          platform={currentPlatform.id}
          close={hideLoaderOnboarding}
        />
      ) : (
        <SdkDocumentation
          platform={currentPlatform}
          organization={organization}
          projectSlug={project.slug}
          projectId={project.id}
          activeProductSelection={products}
        />
      )}
      <div>
        {isGettingStarted && showPerformancePrompt && (
          <Feature
            features="performance-view"
            hookName="feature-disabled:performance-new-project"
          >
            {({hasFeature}) => {
              if (hasFeature) {
                return null;
              }
              return (
                <StyledAlert type="info" showIcon>
                  {t(
                    `Your selected platform supports performance, but your organization does not have performance enabled.`
                  )}
                </StyledAlert>
              );
            }}
          </Feature>
        )}
        <StyledButtonBar gap={1}>
          <LinkButton
            priority="primary"
            busy={loading}
            to={{
              pathname: issueStreamLink,
              query: {
                project: project?.id,
              },
              hash: '#welcome',
            }}
          >
            {t('Take me to Issues')}
          </LinkButton>
          {!isSelfHostedErrorsOnly && (
            <LinkButton
              busy={loading}
              to={{
                pathname: performanceOverviewLink,
                query: {
                  project: project?.id,
                },
              }}
            >
              {t('Take me to Performance')}
            </LinkButton>
          )}
          {!isSelfHostedErrorsOnly && showReplayButton && (
            <LinkButton
              busy={loading}
              to={{
                pathname: replayLink,
                query: {
                  project: project?.id,
                },
              }}
            >
              {t('Take me to Session Replay')}
            </LinkButton>
          )}
        </StyledButtonBar>
      </div>
    </Fragment>
  );
}

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(3)};
  width: max-content;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    width: auto;
    grid-row-gap: ${space(1)};
    grid-auto-flow: row;
  }
`;

const StyledAlert = styled(Alert)`
  margin-top: ${space(2)};
`;
