import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import type {LocationDescriptorObject} from 'history';

import Feature from 'sentry/components/acl/feature';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import NotFound from 'sentry/components/errors/notFound';
import HookOrDefault from 'sentry/components/hookOrDefault';
import {SdkDocumentation} from 'sentry/components/onboarding/gettingStartedDoc/sdkDocumentation';
import type {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {platformProductAvailability} from 'sentry/components/onboarding/productSelection';
import {setPageFiltersStorage} from 'sentry/components/organizations/pageFilters/persistence';
import {performance as performancePlatforms} from 'sentry/data/platformCategories';
import type {Platform} from 'sentry/data/platformPickerCategories';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {space} from 'sentry/styles/space';
import type {PlatformIntegration, PlatformKey, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeList} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import {OtherPlatformsInfo} from './otherPlatformsInfo';
import {PlatformDocHeader} from './platformDocHeader';

const ProductUnavailableCTAHook = HookOrDefault({
  hookName: 'component:product-unavailable-cta',
});

type Props = {
  currentPlatformKey: PlatformKey;
  platform: PlatformIntegration | undefined;
  project: Project;
};

export function ProjectInstallPlatform({
  project,
  currentPlatformKey,
  platform: currentPlatform,
}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();

  const isSelfHosted = ConfigStore.get('isSelfHosted');

  const products = useMemo(
    () => decodeList(location.query.product ?? []) as ProductSolution[],
    [location.query.product]
  );

  const platform: Platform = {
    key: currentPlatformKey,
    id: currentPlatform?.id,
    name: currentPlatform?.name,
    link: currentPlatform?.link,
  };

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
                <Alert.Container>
                  <StyledAlert type="info" showIcon>
                    {t(
                      `Your selected platform supports performance, but your organization does not have performance enabled.`
                    )}
                  </StyledAlert>
                </Alert.Container>
              );
            }}
          </Feature>
        )}
        <StyledButtonBar gap="md">
          <Button
            priority="primary"
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

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    width: auto;
    grid-row-gap: ${space(1)};
    grid-auto-flow: row;
  }
`;

const StyledAlert = styled(Alert)`
  margin-top: ${space(2)};
`;
