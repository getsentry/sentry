import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';
import {Location} from 'history';
import beautify from 'js-beautify';

import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingError from 'sentry/components/loadingError';
import {DocumentationWrapper} from 'sentry/components/onboarding/documentationWrapper';
import {
  ProductSelection,
  ProductSolution,
} from 'sentry/components/onboarding/productSelection';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PlatformKey} from 'sentry/types';
import {Organization, Project, ProjectKey} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import {decodeList} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';

const ProductSelectionAvailabilityHook = HookOrDefault({
  hookName: 'component:product-selection-availability',
  defaultComponent: ProductSelection,
});

export function SetupDocsLoader({
  organization,
  location,
  project,
  platform,
  close,
}: {
  close: () => void;
  location: Location;
  organization: Organization;
  platform: PlatformKey | null;
  project: Project;
}) {
  const api = useApi();
  const currentPlatform = platform ?? project?.platform ?? 'other';
  const [projectKey, setProjectKey] = useState<ProjectKey | null>(null);
  const [hasLoadingError, setHasLoadingError] = useState(false);
  const [projectKeyUpdateError, setProjectKeyUpdateError] = useState(false);

  const productsQuery =
    (location.query.product as ProductSolution | ProductSolution[] | undefined) ?? [];
  const products = decodeList(productsQuery) as ProductSolution[];

  const fetchData = useCallback(async () => {
    const keysApiUrl = `/projects/${organization.slug}/${project.slug}/keys/`;

    try {
      const loadedKeys = await api.requestPromise(keysApiUrl);

      if (loadedKeys.length === 0) {
        setHasLoadingError(true);
        return;
      }

      setProjectKey(loadedKeys[0]);
      setHasLoadingError(false);
    } catch (error) {
      setHasLoadingError(error);
      throw error;
    }
  }, [api, organization.slug, project.slug]);

  // Automatically update the products on the project key when the user changes the product selection
  // Note that on initial visit, this will also update the project key with the default products (=all products)
  // This DOES NOT take into account any initial products that may already be set on the project key - they will always be overwritten!
  const handleUpdateSelectedProducts = useCallback(async () => {
    const keyId = projectKey?.id;

    if (!keyId) {
      return;
    }

    const newDynamicSdkLoaderOptions: ProjectKey['dynamicSdkLoaderOptions'] = {
      hasPerformance: false,
      hasReplay: false,
      hasDebug: false,
    };

    products.forEach(product => {
      // eslint-disable-next-line default-case
      switch (product) {
        case ProductSolution.PERFORMANCE_MONITORING:
          newDynamicSdkLoaderOptions.hasPerformance = true;
          break;
        case ProductSolution.SESSION_REPLAY:
          newDynamicSdkLoaderOptions.hasReplay = true;
          break;
      }
    });

    try {
      await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/keys/${keyId}/`,
        {
          method: 'PUT',
          data: {
            dynamicSdkLoaderOptions: newDynamicSdkLoaderOptions,
          },
        }
      );
      setProjectKeyUpdateError(false);
    } catch (error) {
      const message = t('Unable to updated dynamic SDK loader configuration');
      handleXhrErrorResponse(message, error);
      setProjectKeyUpdateError(true);
    }
  }, [api, organization.slug, project.slug, projectKey?.id, products]);

  const track = useCallback(() => {
    if (!project?.id) {
      return;
    }

    trackAnalytics('onboarding.setup_loader_docs_rendered', {
      organization,
      platform: currentPlatform,
      project_id: project?.id,
    });
  }, [organization, currentPlatform, project?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData, organization.slug, project.slug]);

  useEffect(() => {
    handleUpdateSelectedProducts();
  }, [handleUpdateSelectedProducts, location.query.product]);

  useEffect(() => {
    track();
  }, [track]);

  return (
    <Fragment>
      <Header>
        <ProductSelectionAvailabilityHook
          organization={organization}
          lazyLoader
          skipLazyLoader={close}
          platform={currentPlatform}
        />
      </Header>
      <Divider />
      {projectKeyUpdateError && (
        <LoadingError
          message={t('Failed to update the project key with the selected products.')}
          onRetry={handleUpdateSelectedProducts}
        />
      )}

      {!hasLoadingError ? (
        projectKey !== null && (
          <ProjectKeyInfo
            projectKey={projectKey}
            platform={platform}
            organization={organization}
            project={project}
            products={products}
          />
        )
      ) : (
        <LoadingError
          message={t('Failed to load Client Keys for the project.')}
          onRetry={fetchData}
        />
      )}
    </Fragment>
  );
}

function ProjectKeyInfo({
  projectKey,
  platform,
  organization,
  project,
  products,
}: {
  organization: Organization;
  platform: PlatformKey | null;
  products: ProductSolution[];
  project: Project;
  projectKey: ProjectKey;
}) {
  const [showOptionalConfig, setShowOptionalConfig] = useState(false);

  const loaderLink = projectKey.dsn.cdn;
  const currentPlatform = platform ?? project?.platform ?? 'other';
  const hasPerformance = products.includes(ProductSolution.PERFORMANCE_MONITORING);
  const hasSessionReplay = products.includes(ProductSolution.SESSION_REPLAY);

  const configCodeSnippet = beautify.html(
    `<script>
Sentry.onLoad(function() {
  Sentry.init({${
    !(hasPerformance || hasSessionReplay)
      ? `
    // You can add any additional configuration here`
      : ''
  }${
    hasPerformance
      ? `
    // Performance Monitoring
    tracesSampleRate: 1.0, // Capture 100% of the transactions`
      : ''
  }${
    hasSessionReplay
      ? `
    // Session Replay
    replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
    replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.`
      : ''
  }
  });
});
</script>`,
    {indent_size: 2}
  );

  const verifyCodeSnippet = beautify.html(
    `<script>
  myUndefinedFunction();
</script>`,
    {indent_size: 2}
  );

  const toggleOptionalConfiguration = useCallback(() => {
    const show = !showOptionalConfig;

    setShowOptionalConfig(show);

    if (show) {
      trackAnalytics('onboarding.js_loader_optional_configuration_shown', {
        organization,
        platform: currentPlatform,
        project_id: project.id,
      });
    }
  }, [organization, project.id, currentPlatform, showOptionalConfig]);

  return (
    <DocsWrapper>
      <DocumentationWrapper>
        <h2>{t('Install')}</h2>
        <p>{t('Add this script tag to the top of the page:')}</p>

        <CodeSnippet dark language="html">
          {beautify.html(
            `<script src="${loaderLink}" crossorigin="anonymous"></script>`,
            {indent_size: 2, wrap_attributes: 'force-expand-multiline'}
          )}
        </CodeSnippet>

        <OptionalConfigWrapper>
          <ToggleButton
            priority="link"
            borderless
            size="zero"
            icon={<IconChevron direction={showOptionalConfig ? 'down' : 'right'} />}
            aria-label={t('Toggle optional configuration')}
            onClick={toggleOptionalConfiguration}
          />
          <h2 onClick={toggleOptionalConfiguration}>{t('Configuration (Optional)')}</h2>
        </OptionalConfigWrapper>
        {showOptionalConfig && (
          <div>
            <p>
              {t(
                "Initialize Sentry as early as possible in your application's lifecycle."
              )}
            </p>
            <CodeSnippet dark language="html">
              {configCodeSnippet}
            </CodeSnippet>
          </div>
        )}

        <h2>{t('Verify')}</h2>
        <p>
          {t(
            "This snippet contains an intentional error and can be used as a test to make sure that everything's working as expected."
          )}
        </p>
        <CodeSnippet dark language="html">
          {verifyCodeSnippet}
        </CodeSnippet>

        <hr />

        <h2>{t('Next Steps')}</h2>
        <ul>
          <li>
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/sourcemaps/">
              {t('Source Maps')}
            </ExternalLink>
            {': '}
            {t('Learn how to enable readable stack traces in your Sentry errors.')}
          </li>
          <li>
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/configuration/">
              {t('SDK Configuration')}
            </ExternalLink>
            {': '}
            {t('Learn how to configure your SDK using our Loader Script')}
          </li>
          {!products.includes(ProductSolution.PERFORMANCE_MONITORING) && (
            <li>
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/performance/">
                {t('Performance Monitoring')}
              </ExternalLink>
              {': '}
              {t(
                'Track down transactions to connect the dots between 10-second page loads and poor-performing API calls or slow database queries.'
              )}
            </li>
          )}
          {!products.includes(ProductSolution.SESSION_REPLAY) && (
            <li>
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/session-replay/">
                {t('Session Replay')}
              </ExternalLink>
              {': '}
              {t(
                'Get to the root cause of an error or latency issue faster by seeing all the technical details related to that issue in one visual replay on your web application.'
              )}
            </li>
          )}
        </ul>
      </DocumentationWrapper>
    </DocsWrapper>
  );
}

const DocsWrapper = styled(motion.div)``;

const Header = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const OptionalConfigWrapper = styled('div')`
  display: flex;
  cursor: pointer;
`;

const ToggleButton = styled(Button)`
  &,
  :hover {
    color: ${p => p.theme.gray500};
  }
`;

const Divider = styled('hr')<{withBottomMargin?: boolean}>`
  height: 1px;
  width: 100%;
  background: ${p => p.theme.border};
  border: none;
`;
