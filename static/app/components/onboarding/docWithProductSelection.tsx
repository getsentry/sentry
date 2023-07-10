import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import {Location} from 'history';

import {Alert} from 'sentry/components/alert';
import HookOrDefault from 'sentry/components/hookOrDefault';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DocumentationWrapper} from 'sentry/components/onboarding/documentationWrapper';
import {MissingExampleWarning} from 'sentry/components/onboarding/missingExampleWarning';
import {ProductSolution} from 'sentry/components/onboarding/productSelection';
import {PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';
import {OnboardingPlatformDoc} from 'sentry/types/onboarding';
import {trackAnalytics} from 'sentry/utils/analytics';
import getDynamicText from 'sentry/utils/getDynamicText';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import SetupIntroduction from 'sentry/views/onboarding/components/setupIntroduction';
import {SetupDocsLoader} from 'sentry/views/onboarding/setupDocsLoader';

const ProductSelectionAvailabilityHook = HookOrDefault({
  hookName: 'component:product-selection-availability',
});

export function DocWithProductSelection({
  location,
  newOrg,
  currentPlatform,
  project,
}: {
  currentPlatform: PlatformKey;
  location: Location;
  project: Project;
  newOrg?: boolean;
}) {
  const organization = useOrganization();
  const [showLoaderDocs, setShowLoaderDocs] = useState(currentPlatform === 'javascript');

  const loadPlatform = useMemo(() => {
    const products = location.query.product ?? [];
    return products.includes(ProductSolution.PERFORMANCE_MONITORING) &&
      products.includes(ProductSolution.SESSION_REPLAY)
      ? `${currentPlatform}-with-error-monitoring-performance-and-replay`
      : products.includes(ProductSolution.PERFORMANCE_MONITORING)
      ? `${currentPlatform}-with-error-monitoring-and-performance`
      : products.includes(ProductSolution.SESSION_REPLAY)
      ? `${currentPlatform}-with-error-monitoring-and-replay`
      : `${currentPlatform}-with-error-monitoring`;
  }, [location.query.product, currentPlatform]);

  const {data, isLoading, isError, refetch} = useApiQuery<OnboardingPlatformDoc>(
    [`/projects/${organization.slug}/${project?.slug}/docs/${loadPlatform}/`],
    {
      staleTime: Infinity,
      enabled: !!project?.slug && !!organization.slug && !!loadPlatform,
    }
  );

  const platformName = platforms.find(p => p.id === currentPlatform)?.name ?? '';

  const closeLoaderDocs = useCallback(() => {
    setShowLoaderDocs(false);

    if (!project?.id) {
      return;
    }

    trackAnalytics('onboarding.js_loader_npm_docs_shown', {
      organization,
      platform: currentPlatform,
      project_id: project?.id,
    });
  }, [organization, currentPlatform, project?.id]);

  if (showLoaderDocs) {
    return (
      <SetupDocsLoader
        organization={organization}
        project={project}
        location={location}
        platform={currentPlatform}
        close={closeLoaderDocs}
        showDocsWithProductSelection
      />
    );
  }

  return (
    <Fragment>
      {newOrg && (
        <SetupIntroduction
          stepHeaderText={t('Configure %s SDK', platformName)}
          platform={currentPlatform}
        />
      )}
      <ProductSelectionAvailabilityHook organization={organization} />
      {isLoading ? (
        <LoadingIndicator />
      ) : isError ? (
        <LoadingError
          message={t('Failed to load documentation for the %s platform.', platformName)}
          onRetry={refetch}
        />
      ) : (
        getDynamicText({
          value: (
            <DocsWrapper>
              <DocumentationWrapper
                dangerouslySetInnerHTML={{__html: data?.html ?? ''}}
              />
              <MissingExampleWarning
                platform={currentPlatform}
                platformDocs={{
                  html: data?.html ?? '',
                  link: data?.link ?? '',
                }}
              />
            </DocsWrapper>
          ),
          fixed: (
            <Alert type="warning">
              Platform documentation is not rendered in for tests in CI
            </Alert>
          ),
        })
      )}
    </Fragment>
  );
}

const DocsWrapper = styled(motion.div)``;

DocsWrapper.defaultProps = {
  initial: {opacity: 0, y: 40},
  animate: {opacity: 1, y: 0},
  exit: {opacity: 0},
};
