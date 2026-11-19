import {Fragment} from 'react';
import type {LocationDescriptorObject} from 'history';
import {parseAsStringLiteral, useQueryStates} from 'nuqs';

import {Button} from '@sentry/scraps/button';
import {Grid} from '@sentry/scraps/layout';

import {NotFound} from 'sentry/components/errors/notFound';
import {SdkDocumentation} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import type {
  DocsFlow,
  ProductSolution,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {platformProductAvailability} from 'sentry/components/onboarding/productSelection';
import {OverrideOrDefault} from 'sentry/components/overrideOrDefault';
import {setPageFiltersStorage} from 'sentry/components/pageFilters/persistence';
import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import type {PlatformIntegration, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {ProjectCreationVariant} from 'sentry/utils/analytics/projectCreationAnalyticsEvents';
import {useRouteAnalyticsEventNames} from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {parseAsStringArray} from 'sentry/utils/url/parseAsStringArray';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';

import {OtherPlatformsInfo} from './otherPlatformsInfo';
import {PlatformDocHeader} from './platformDocHeader';
import {useScmCreateProjectProductSync} from './scmCreateProjectSession';

const ProductUnavailableCTA = OverrideOrDefault({
  overrideName: 'component:product-unavailable-cta',
});

type Props = {
  platform: PlatformIntegration | undefined;
  project: Project;
};

type ProjectCreationGettingStartedAnalyticsProps = {
  platform: string;
  products: ProductSolution[];
  projectId: string;
  variant: ProjectCreationVariant;
};

function ProjectCreationGettingStartedAnalytics({
  platform,
  products,
  projectId,
  variant,
}: ProjectCreationGettingStartedAnalyticsProps) {
  useRouteAnalyticsEventNames(
    'project_creation.getting_started_viewed',
    'Project Creation: Getting Started Viewed'
  );
  useRouteAnalyticsParams({platform, products, project_id: projectId, variant});

  return null;
}

const platformParsers = {
  projectCreationVariant: parseAsStringLiteral(['scm', 'legacy'] as const),
  product: parseAsStringArray,
};

export function ProjectInstallPlatform({project, platform}: Props) {
  const organization = useOrganization();
  const navigate = useNavigate();
  const [{projectCreationVariant: variantParam, product}] =
    useQueryStates(platformParsers);
  const projectCreationVariant = variantParam ?? undefined;

  const isSelfHosted = ConfigStore.get('isSelfHosted');

  const onProductSelectionSync = useScmCreateProjectProductSync(project);

  // Attribute setup-docs analytics from the flow that actually created this
  // project. Experiment enrollment alone is insufficient: users can visit
  // getting-started for older or unrelated projects while still enrolled.
  const docsFlow: DocsFlow | undefined =
    projectCreationVariant === 'scm'
      ? 'project-creation-scm'
      : projectCreationVariant === 'legacy'
        ? 'project-creation'
        : undefined;

  const products = product as ProductSolution[];

  const redirectWithProjectSelection = (to: LocationDescriptorObject) => {
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
  };

  if (!platform) {
    return <NotFound />;
  }

  const issueStreamLink = `/organizations/${organization.slug}/issues/`;
  const showDocsWithProductSelection =
    (platformProductAvailability[platform.id] ?? []).length > 0;

  return (
    <Fragment>
      {projectCreationVariant && (
        <ProjectCreationGettingStartedAnalytics
          platform={platform.name ?? 'unknown'}
          products={products}
          projectId={project.id}
          variant={projectCreationVariant}
        />
      )}
      {!isSelfHosted && showDocsWithProductSelection && (
        <ProductUnavailableCTA organization={organization} />
      )}
      <PlatformDocHeader
        projectSlug={project.slug}
        platform={platform}
        projectCreationVariant={projectCreationVariant}
      />
      {platform.id === 'other' ? (
        <OtherPlatformsInfo
          projectSlug={project.slug}
          platform={platform.name ?? 'other'}
        />
      ) : (
        <SdkDocumentation
          platform={platform}
          organization={organization}
          project={project}
          activeProductSelection={products}
          onProductSelectionSync={onProductSelectionSync}
          docsFlow={docsFlow}
        />
      )}
      <div>
        <Grid
          flow={{zero: 'row', xl: 'column'}}
          align="center"
          gap="md"
          marginTop="2xl"
          width={{zero: 'auto', xl: 'max-content'}}
        >
          <Button
            variant="primary"
            onClick={() => {
              const analyticsParams = {
                organization,
                platform: platform.name ?? 'unknown',
                project_id: project.id,
                products,
              };
              if (projectCreationVariant) {
                trackAnalytics('project_creation.take_me_to_issues_clicked', {
                  ...analyticsParams,
                  variant: projectCreationVariant,
                });
              } else {
                trackAnalytics('onboarding.take_me_to_issues_clicked', analyticsParams);
              }
              redirectWithProjectSelection({
                pathname: issueStreamLink,
              });
            }}
          >
            {t('Take me to Issues')}
          </Button>
        </Grid>
      </div>
    </Fragment>
  );
}
