import {Fragment, useCallback, useContext, useEffect, useMemo, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import omit from 'lodash/omit';

import {loadDocs, removeProject} from 'sentry/actionCreators/projects';
import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import Confirm from 'sentry/components/confirm';
import NotFound from 'sentry/components/errors/notFound';
import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DocumentationWrapper} from 'sentry/components/onboarding/documentationWrapper';
import {Footer} from 'sentry/components/onboarding/footer';
import {
  migratedDocs,
  SdkDocumentation,
} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {useRecentCreatedProject} from 'sentry/components/onboarding/useRecentCreatedProject';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {
  performance as performancePlatforms,
  Platform,
  PlatformKey,
} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {OnboardingSelectedSDK, Organization, Project} from 'sentry/types';
import {IssueAlertRule} from 'sentry/types/alerts';
import {trackAnalytics} from 'sentry/utils/analytics';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {SetupDocsLoader} from 'sentry/views/onboarding/setupDocsLoader';
import {GettingStartedWithProjectContext} from 'sentry/views/projects/gettingStartedWithProjectContext';

const ProductUnavailableCTAHook = HookOrDefault({
  hookName: 'component:product-unavailable-cta',
});

type Props = RouteComponentProps<{projectId: string}, {}>;

export function SetUpGeneralSdkDoc({
  organization,
  projectSlug,
  platform,
}: {
  organization: Organization;
  platform: Platform;
  projectSlug: Project['slug'];
}) {
  const api = useApi();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [html, setHtml] = useState('');

  const fetchDocs = useCallback(async () => {
    setLoading(true);

    try {
      const {html: reponse} = await loadDocs({
        api,
        orgSlug: organization.slug,
        projectSlug,
        platform: platform.key as PlatformKey,
      });
      setHtml(reponse);
      window.scrollTo(0, 0);
    } catch (err) {
      setError(err);
    }

    setLoading(false);
  }, [api, organization.slug, projectSlug, platform.key]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  return (
    <div>
      <Alert type="info" showIcon>
        {tct(
          `
           This is a quick getting started guide. For in-depth instructions
           on integrating Sentry with [platform], view
           [docLink:our complete documentation].`,
          {
            platform: platform.name,
            docLink: <ExternalLink href={platform.link ?? undefined} />,
          }
        )}
      </Alert>
      {loading ? (
        <LoadingIndicator />
      ) : error ? (
        <LoadingError onRetry={fetchDocs} />
      ) : (
        <Fragment>
          <SentryDocumentTitle
            title={`${t('Configure')} ${platform.name}`}
            projectSlug={projectSlug}
          />
          <DocumentationWrapper dangerouslySetInnerHTML={{__html: html}} />
        </Fragment>
      )}
    </div>
  );
}

export function ProjectInstallPlatform({location, params, route, router}: Props) {
  const organization = useOrganization();
  const api = useApi();
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
  const currentPlatform = platforms.find(p => p.id === currentPlatformKey);

  const [showLoaderOnboarding, setShowLoaderOnboarding] = useState(
    currentPlatform?.id === 'javascript'
  );

  const products = useMemo(
    () => (location.query.product ?? []) as ProductSolution[],
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

  const heartbeatFooter = !!organization?.features.includes(
    'onboarding-heartbeat-footer'
  );

  const projectDeletionOnBackClick = !!organization?.features.includes(
    'onboarding-project-deletion-on-back-click'
  );

  // This is a feature flag that is currently only enabled for a subset of internal users until the feature is fully implemented,
  // but the purpose of the feature is to make the product selection feature in documents available to all users
  // and guide them to upgrade to a plan if one of the products is not available on their current plan.
  const gettingStartedDocWithProductSelection = !!organization?.features.includes(
    'getting-started-doc-with-product-selection'
  );

  const recentCreatedProject = useRecentCreatedProject({
    orgSlug: organization.slug,
    projectSlug: project?.slug,
  });

  const shallProjectBeDeleted =
    projectDeletionOnBackClick &&
    recentCreatedProject &&
    // if the project has received a first error, we don't delete it
    recentCreatedProject.firstError === false &&
    // if the project has received a first transaction, we don't delete it
    recentCreatedProject.firstTransaction === false &&
    // if the project has replays, we don't delete it
    recentCreatedProject.hasReplays === false &&
    // if the project has sessions, we don't delete it
    recentCreatedProject.hasSessions === false &&
    // if the project is older than one hour, we don't delete it
    recentCreatedProject.olderThanOneHour === false;

  const platformIntegration = platforms.find(p => p.id === currentPlatformKey);
  const platform: Platform = {
    key: currentPlatformKey as PlatformKey,
    id: platformIntegration?.id,
    name: platformIntegration?.name,
    link: platformIntegration?.link,
  };

  const redirectToNeutralDocs = useCallback(() => {
    if (!project?.slug) {
      return;
    }

    router.push(
      normalizeUrl(
        `/organizations/${organization.slug}/projects/${project.slug}/getting-started/`
      )
    );
  }, [organization.slug, project?.slug, router]);

  const handleGoBack = useCallback(async () => {
    if (!recentCreatedProject) {
      return;
    }

    trackAnalytics('project_creation.back_button_clicked', {
      organization,
    });

    if (shallProjectBeDeleted) {
      trackAnalytics('project_creation.data_removal_modal_confirm_button_clicked', {
        organization,
        platform: recentCreatedProject.slug,
        project_id: recentCreatedProject.id,
      });

      try {
        await removeProject({
          api,
          orgSlug: organization.slug,
          projectSlug: recentCreatedProject.slug,
          origin: 'getting_started',
        });

        trackAnalytics('project_creation.data_removed', {
          organization,
          date_created: recentCreatedProject.dateCreated,
          platform: recentCreatedProject.slug,
          project_id: recentCreatedProject.id,
        });
      } catch (error) {
        handleXhrErrorResponse('Unable to delete project in project creation', error);
        // we don't give the user any feedback regarding this error as this shall be silent
      }
    }

    router.replace(
      normalizeUrl(
        `/organizations/${organization.slug}/projects/new/?referrer=getting-started&project=${recentCreatedProject.id}`
      )
    );
  }, [api, recentCreatedProject, organization, shallProjectBeDeleted, router]);

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

  useEffect(() => {
    // redirect if platform is not known.
    if (!platform.key || platform.key === 'other') {
      redirectToNeutralDocs();
    }
  }, [platform.key, redirectToNeutralDocs]);

  if (!project) {
    return null;
  }

  if (!platform.id) {
    return <NotFound />;
  }

  const issueStreamLink = `/organizations/${organization.slug}/issues/`;
  const performanceOverviewLink = `/organizations/${organization.slug}/performance/`;
  const showPerformancePrompt = performancePlatforms.includes(platform.id as PlatformKey);
  const isGettingStarted = window.location.href.indexOf('getting-started') > 0;

  const showDocsWithProductSelection =
    gettingStartedDocWithProductSelection &&
    (platform.key === 'javascript' || !!platform.key.match('^javascript-([A-Za-z]+)$'));

  return (
    <Fragment>
      {!isSelfHosted && showDocsWithProductSelection && (
        <ProductUnavailableCTAHook organization={organization} />
      )}
      <StyledPageHeader>
        <h2>{t('Configure %(platform)s SDK', {platform: platform.name})}</h2>
        <ButtonBar gap={1}>
          <Confirm
            bypass={!shallProjectBeDeleted}
            message={t(
              "Hey, just a heads up - we haven't received any data for this SDK yet and by going back all changes will be discarded. Are you sure you want to head back?"
            )}
            priority="danger"
            confirmText={t("Yes I'm sure")}
            onConfirm={handleGoBack}
            onClose={() => {
              if (!recentCreatedProject) {
                return;
              }
              trackAnalytics('project_creation.data_removal_modal_dismissed', {
                organization,
                platform: recentCreatedProject.slug,
                project_id: recentCreatedProject.id,
              });
            }}
            onRender={() => {
              if (!recentCreatedProject) {
                return;
              }
              trackAnalytics('project_creation.data_removal_modal_rendered', {
                organization,
                platform: recentCreatedProject.slug,
                project_id: recentCreatedProject.id,
              });
            }}
          >
            <Button icon={<IconChevron direction="left" size="sm" />} size="sm">
              {t('Back to Platform Selection')}
            </Button>
          </Confirm>
          <Button size="sm" href={platform.link ?? undefined} external>
            {t('Full Documentation')}
          </Button>
        </ButtonBar>
      </StyledPageHeader>
      {currentPlatform && showLoaderOnboarding ? (
        <SetupDocsLoader
          organization={organization}
          project={project}
          location={location}
          platform={currentPlatform.id}
          close={hideLoaderOnboarding}
        />
      ) : currentPlatform && migratedDocs.includes(currentPlatformKey) ? (
        <SdkDocumentation
          platform={currentPlatform}
          orgSlug={organization.slug}
          projectSlug={project.slug}
          activeProductSelection={products}
        />
      ) : (
        <SetUpGeneralSdkDoc
          organization={organization}
          projectSlug={project.slug}
          platform={platform}
        />
      )}
      <div>
        {isGettingStarted && showPerformancePrompt && (
          <Feature
            features={['performance-view']}
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

        {isGettingStarted && heartbeatFooter ? (
          <Footer
            projectSlug={params.projectId}
            projectId={project?.id}
            route={route}
            router={router}
            location={location}
          />
        ) : (
          <StyledButtonBar gap={1}>
            <Button
              priority="primary"
              busy={loadingProjects}
              to={{
                pathname: issueStreamLink,
                query: project?.id,
                hash: '#welcome',
              }}
            >
              {t('Take me to Issues')}
            </Button>
            <Button
              busy={loadingProjects}
              to={{
                pathname: performanceOverviewLink,
                query: project?.id,
              }}
            >
              {t('Take me to Performance')}
            </Button>
          </StyledButtonBar>
        )}
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

const StyledPageHeader = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(3)};

  h2 {
    margin: 0;
  }

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column;
    align-items: flex-start;

    h2 {
      margin-bottom: ${space(2)};
    }
  }
`;

const StyledAlert = styled(Alert)`
  margin-top: ${space(2)};
`;
