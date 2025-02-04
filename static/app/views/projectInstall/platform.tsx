import {Fragment, useCallback, useContext, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptorObject} from 'history';
import omit from 'lodash/omit';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import NotFound from 'sentry/components/errors/notFound';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {SdkDocumentation} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {platformProductAvailability} from 'sentry/components/onboarding/productSelection';
import {getMergedTasks} from 'sentry/components/onboardingWizard/taskConfig';
import {taskIsDone} from 'sentry/components/onboardingWizard/utils';
import {setPageFiltersStorage} from 'sentry/components/organizations/pageFilters/persistence';
import {performance as performancePlatforms} from 'sentry/data/platformCategories';
import type {Platform} from 'sentry/data/platformPickerCategories';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {space} from 'sentry/styles/space';
import type {IssueAlertRule} from 'sentry/types/alerts';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import type {PlatformIntegration, PlatformKey, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeEnabled} from 'sentry/utils/demoMode';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useOnboardingSidebar} from 'sentry/views/onboarding/useOnboardingSidebar';
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
  const navigate = useNavigate();
  const gettingStartedWithProjectContext = useContext(GettingStartedWithProjectContext);
  const onboardingContext = useContext(OnboardingContext);
  const {activateSidebar} = useOnboardingSidebar();

  const isSelfHosted = ConfigStore.get('isSelfHosted');

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
    if (!project || projectAlertRulesIsLoading || projectAlertRulesIsError) {
      return;
    }

    if (gettingStartedWithProjectContext.project?.id === project.id) {
      return;
    }

    const platformKey = Object.keys(platforms).find(
      // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
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
        // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
        ...omit(platforms[platformKey], 'id'),
        // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
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

  const openOnboardingSidebar = useCallback(() => {
    if (isDemoModeEnabled()) {
      return;
    }

    const tasks = getMergedTasks({
      organization,
      projects: project ? [project] : undefined,
      onboardingContext,
    });

    const allDisplayedTasks = tasks.filter(task => task.display);
    const doneTasks = allDisplayedTasks.filter(taskIsDone);

    if (!(doneTasks.length >= allDisplayedTasks.length)) {
      activateSidebar();
    }
  }, [onboardingContext, organization, project, activateSidebar]);

  const redirectWithProjectSelection = useCallback(
    (to: LocationDescriptorObject) => {
      if (!project?.id) {
        return;
      }
      // We need to persist and pin the project filter
      // so the selection does not reset on further navigation
      PageFiltersStore.updateProjects([Number(project?.id)], null);
      PageFiltersStore.pin('projects', true);
      setPageFiltersStorage(organization.slug, new Set(['projects']));

      navigate({
        ...to,
        query: {
          ...to.query,
          project: project?.id,
        },
      });
    },
    [navigate, organization.slug, project?.id]
  );

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
            busy={loading}
            onClick={() => {
              trackAnalytics('onboarding.take_me_to_issues_clicked', {
                organization,
                platform: platform.name ?? 'unknown',
                project_id: project.id,
                products,
              });
              redirectWithProjectSelection({
                pathname: issueStreamLink,
              });
              openOnboardingSidebar();
            }}
          >
            {t('Take me to Issues')}
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
