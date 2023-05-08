import {Fragment, useMemo} from 'react';
import {motion} from 'framer-motion';
import {Location} from 'history';

import {Alert} from 'sentry/components/alert';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {DocumentationWrapper} from 'sentry/components/onboarding/documentationWrapper';
import {PRODUCT, ProductSelection} from 'sentry/components/onboarding/productSelection';
import {PlatformKey} from 'sentry/data/platformCategories';
import platforms from 'sentry/data/platforms';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';
import {useApiQuery} from 'sentry/utils/queryClient';
import SetupIntroduction from 'sentry/views/onboarding/components/setupIntroduction';

import {MissingExampleWarning} from './missingExampleWarning';
import {PlatformDoc} from '.';

export function SdkDocWithProductSelection({
  organization,
  location,
  projectSlug,
  newOrg,
  currentPlatform,
}: {
  currentPlatform: PlatformKey;
  location: Location;
  organization: Organization;
  projectSlug: Project['slug'];
  newOrg?: boolean;
}) {
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

  const {data, isLoading, isError, refetch} = useApiQuery<PlatformDoc>(
    [`/projects/${organization.slug}/${projectSlug}/docs/${loadPlatform}/`],
    {
      staleTime: Infinity,
      enabled: !!projectSlug && !!organization.slug && !!loadPlatform,
    }
  );

  const platformName = platforms.find(p => p.id === currentPlatform)?.name ?? '';

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
            <motion.div
              {...{
                initial: {opacity: 0, y: 40},
                animate: {opacity: 1, y: 0},
                exit: {opacity: 0},
              }}
            >
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
            </motion.div>
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
