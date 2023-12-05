import {Fragment, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import NotFound from 'sentry/components/errors/notFound';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {SdkDocumentation} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {
  platformProductAvailability,
  ProductSolution,
} from 'sentry/components/onboarding/productSelection';
import {performance as performancePlatforms} from 'sentry/data/platformCategories';
import {Platform} from 'sentry/data/platformPickerCategories';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {PlatformIntegration, PlatformKey} from 'sentry/types';
import {OnboardingSelectedSDK} from 'sentry/types';
import {IssueAlertRule} from 'sentry/types/alerts';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeList} from 'sentry/utils/queryString';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {SetupDocsLoader} from 'sentry/views/onboarding/setupDocsLoader';
import {GettingStartedWithProjectContext} from 'sentry/views/projects/gettingStartedWithProjectContext';

import {OtherPlatformsInfo} from './otherPlatformsInfo';
import {PlatformDocHeader} from './platformDocHeader';

const allPlatforms: PlatformIntegration[] = [
  ...platforms,
  {
    id: 'other',
    name: t('Other'),
    link: 'https://docs.sentry.io/platforms/',
    type: 'language',
    language: 'other',
  },
];

const ProductUnavailableCTAHook = HookOrDefault({
  hookName: 'component:product-unavailable-cta',
});

type Props = RouteComponentProps<{projectId: string}, {}>;

export function ProjectInstallPlatform({location, params}: Props) {
  const organization = useOrganization();
  const gettingStartedWithProjectContext = useContext(GettingStartedWithProjectContext);

  const isSelfHosted = ConfigStore.get('isSelfHosted');

  const {projects, initiallyLoaded} = useProjects({
    slugs: [params.projectId],
    orgId: organization.slug,
  });

  const loadingProjects = !initiallyLoaded;
  const project = !loadingProjects
    ? projects.find(proj => proj.slug === params.projectId)
    : undefined;

  const currentPlatformKey = project?.platform ?? 'other';
  const currentPlatform = allPlatforms.find(p => p.id === currentPlatformKey);

  const [showLoaderOnboarding, setShowLoaderOnboarding] = useState(
    currentPlatform?.id === 'javascript'
  );

  const products = useMemo(
    () => decodeList(location.query.product ?? []) as ProductSolution[],
    [location.query.product]
  );

  const {
    data: projectAlertRules,
    isLoading: projectAlertRulesIsLoading,
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
  const showPerformancePrompt = performancePlatforms.includes(platform.id as PlatformKey);
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
          <Button
            priority="primary"
            busy={loadingProjects}
            to={{
              pathname: issueStreamLink,
              query: {
                project: project?.id,
              },
              hash: '#welcome',
            }}
          >
            {t('Take me to Issues')}
          </Button>
          <Button
            busy={loadingProjects}
            to={{
              pathname: performanceOverviewLink,
              query: {
                project: project?.id,
              },
            }}
          >
            {t('Take me to Performance')}
          </Button>
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
