import {Fragment, useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import {Location} from 'history';

import {Alert} from 'sentry/components/alert';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DocumentationWrapper} from 'sentry/components/onboarding/documentationWrapper';
import {MissingExampleWarning} from 'sentry/components/onboarding/missingExampleWarning';
import {PRODUCT, ProductSelection} from 'sentry/components/onboarding/productSelection';
import {PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {OnboardingPlatformDoc} from 'sentry/types/onboarding';
import {trackAnalytics} from 'sentry/utils/analytics';
import getDynamicText from 'sentry/utils/getDynamicText';
import {useApiQuery} from 'sentry/utils/queryClient';
import SetupIntroduction from 'sentry/views/onboarding/components/setupIntroduction';
import {SetupDocsLoader} from 'sentry/views/onboarding/setupDocsLoader';

export function DocWithProductSelection({
  organization,
  location,
  newOrg,
  currentPlatform,
  project,
}: {
  currentPlatform: PlatformKey;
  location: Location;
  organization: Organization;
  project: Project;
  newOrg?: boolean;
}) {
  const [showLoaderDocs, setShowLoaderDocs] = useState(currentPlatform === 'javascript');

  const loadPlatform = useMemo(() => {
    const products = location.query.product ?? [];
    return products.includes(PRODUCT.PERFORMANCE_MONITORING) &&
      products.includes(PRODUCT.SESSION_REPLAY)
      ? `${currentPlatform}-with-error-monitoring-performance-and-replay`
      : products.includes(PRODUCT.PERFORMANCE_MONITORING)
      ? `${currentPlatform}-with-error-monitoring-and-performance`
      : products.includes(PRODUCT.SESSION_REPLAY)
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
      <ProductSelection
        defaultSelectedProducts={[PRODUCT.PERFORMANCE_MONITORING, PRODUCT.SESSION_REPLAY]}
      />
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
