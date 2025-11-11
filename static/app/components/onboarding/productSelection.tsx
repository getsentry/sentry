import type {ReactNode} from 'react';
import {useCallback, useEffect, useEffectEvent, useMemo} from 'react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {FeatureDisabledModal} from 'sentry/components/acl/featureDisabledModal';
import {Button} from 'sentry/components/core/button';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Flex, Stack} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';
import {withChonk} from 'sentry/utils/theme/withChonk';
import {useOnboardingQueryParams} from 'sentry/views/onboarding/components/useOnboardingQueryParams';

interface DisabledProduct {
  reason: ReactNode;
  onClick?: () => void;
  requiresUpgrade?: boolean;
}

export type DisabledProducts = Partial<Record<ProductSolution, DisabledProduct>>;

function getDisabledProducts(organization: Organization): DisabledProducts {
  const disabledProducts: DisabledProducts = {};
  const hasSessionReplay = organization.features.includes('session-replay');
  const hasPerformance = organization.features.includes('performance-view');
  const hasProfiling = organization.features.includes('profiling-view');
  const hasLogs = organization.features.includes('ourlogs-enabled');
  const hasMetrics = organization.features.includes('tracemetrics-enabled');
  const isSelfHostedErrorsOnly = ConfigStore.get('isSelfHostedErrorsOnly');

  let reason = t('This feature is not enabled on your Sentry installation.');
  const createClickHandler = (feature: string, featureName: string) => () => {
    openModal(deps => (
      <FeatureDisabledModal {...deps} features={[feature]} featureName={featureName} />
    ));
  };

  if (isSelfHostedErrorsOnly) {
    reason = t('This feature is disabled for errors only self-hosted');
    return Object.values(ProductSolution)
      .filter(product => product !== ProductSolution.ERROR_MONITORING)
      .reduce<DisabledProducts>((acc, prod) => {
        acc[prod] = {reason};
        return acc;
      }, {});
  }

  if (!hasSessionReplay) {
    disabledProducts[ProductSolution.SESSION_REPLAY] = {
      reason,
      onClick: createClickHandler('organizations:session-replay', 'Session Replay'),
    };
  }
  if (!hasPerformance) {
    disabledProducts[ProductSolution.PERFORMANCE_MONITORING] = {
      reason,
      onClick: createClickHandler('organizations:performance-view', 'Tracing'),
    };
  }
  if (!hasProfiling) {
    disabledProducts[ProductSolution.PROFILING] = {
      reason,
      onClick: createClickHandler('organizations:profiling-view', 'Profiling'),
    };
  }
  if (!hasLogs) {
    disabledProducts[ProductSolution.LOGS] = {
      reason,
      onClick: createClickHandler('organizations:ourlogs-enabled', 'Logs'),
    };
  }
  if (!hasMetrics) {
    disabledProducts[ProductSolution.METRICS] = {
      reason,
      onClick: createClickHandler('organizations:tracemetrics-enabled', 'Metrics'),
    };
  }
  return disabledProducts;
}

// This is the list of products that are available for each platform
// Since the ProductSelection component is rendered in the onboarding/project creation flow only, it is ok to have this list here
// NOTE: Please keep the prefix in alphabetical order
export const platformProductAvailability = {
  'apple-macos': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  bun: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.LOGS],
  capacitor: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.SESSION_REPLAY],
  dotnet: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'dotnet-aspnet': [ProductSolution.PERFORMANCE_MONITORING],
  'dotnet-aspnetcore': [ProductSolution.PERFORMANCE_MONITORING],
  'dotnet-awslambda': [ProductSolution.PERFORMANCE_MONITORING],
  'dotnet-gcpfunctions': [ProductSolution.PERFORMANCE_MONITORING],
  'dotnet-maui': [ProductSolution.PERFORMANCE_MONITORING],
  'dotnet-winforms': [ProductSolution.PERFORMANCE_MONITORING],
  'dotnet-wpf': [ProductSolution.PERFORMANCE_MONITORING],
  'dotnet-xamarin': [ProductSolution.PERFORMANCE_MONITORING],
  dart: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.LOGS],
  kotlin: [ProductSolution.PERFORMANCE_MONITORING],
  go: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.LOGS],
  'go-echo': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.LOGS],
  'go-fasthttp': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.LOGS],
  'go-fiber': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.LOGS],
  'go-gin': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.LOGS],
  'go-http': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.LOGS],
  'go-iris': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.LOGS],
  'go-negroni': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.LOGS],
  ionic: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.SESSION_REPLAY],
  java: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.LOGS],
  'java-log4j2': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.LOGS],
  'java-logback': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.LOGS],
  'java-spring': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.LOGS],
  'java-spring-boot': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.LOGS],
  javascript: [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.METRICS,
  ],
  'javascript-react': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'javascript-react-router': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'javascript-vue': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'javascript-angular': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'javascript-ember': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'javascript-gatsby': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'javascript-solid': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'javascript-solidstart': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.METRICS,
  ],
  'javascript-svelte': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'javascript-tanstackstart-react': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.METRICS,
  ],
  'javascript-astro': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  node: [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'node-azurefunctions': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'node-awslambda': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.METRICS,
  ],
  'node-connect': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'node-express': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'node-fastify': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'node-gcpfunctions': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'node-hapi': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'node-hono': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'node-koa': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'node-nestjs': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'node-cloudflare-workers': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'node-cloudflare-pages': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  php: [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
  ],
  'php-laravel': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
  ],
  'php-symfony': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  python: [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'python-aiohttp': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'python-asgi': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'python-awslambda': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'python-bottle': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'python-celery': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'python-chalice': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'python-django': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'python-falcon': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'python-fastapi': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'python-flask': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'python-gcpfunctions': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'python-quart': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'python-rq': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'python-serverless': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'python-tornado': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'python-starlette': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  'python-wsgi': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
    ProductSolution.METRICS,
  ],
  ruby: [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
  ],
  'ruby-rack': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
  ],
  'ruby-rails': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
    ProductSolution.LOGS,
  ],
} as Record<PlatformKey, ProductSolution[]>;

type ProductProps = {
  /**
   * If the product is checked. This information is grabbed from the URL.
   */
  checked: boolean;
  /**
   * The name of the product
   */
  label: string;
  /**
   * Brief product description
   */
  description?: ReactNode;
  /**
   * If the product is disabled. It contains a reason and an optional onClick handler
   */
  disabled?: DisabledProduct;
  /**
   * Link of the product documentation. Rendered if there is also a description.
   */
  docLink?: string;
  /**
   * Click handler. If the product is enabled, by clicking on the button, the product is added or removed from the URL.
   */
  onClick?: () => void;
};

function Product({
  disabled,
  checked,
  label,
  onClick,
  docLink,
  description,
}: ProductProps) {
  const isDisabled = !!disabled && !disabled.requiresUpgrade;
  return (
    <Tooltip
      title={
        disabled?.reason ??
        (description && (
          <Stack gap="xs" justify="start">
            {description}
            {docLink && <ExternalLink href={docLink}>{t('Read the Docs')}</ExternalLink>}
          </Stack>
        ))
      }
      delay={500}
      isHoverable
    >
      <ProductButton
        onClick={disabled?.onClick ?? onClick}
        priority={!!disabled || checked ? 'primary' : 'default'}
        disabled={isDisabled}
        aria-label={label}
      >
        <ProductButtonInner>
          <Checkbox
            readOnly
            size="xs"
            // Dont allow focus on the checkbox, as it is part of a button and
            // used mostly for a presentation purpose
            tabIndex={-1}
            role="presentation"
            checked={checked}
            aria-label={label}
            disabled={isDisabled}
          />
          {label}
          <IconQuestion size="xs" />
        </ProductButtonInner>
      </ProductButton>
    </Tooltip>
  );
}

export type ProductSelectionProps = {
  /**
   * The current organization
   */
  organization: Organization;
  /**
   * List of products that are disabled. All of them have to contain a reason by default and optionally an onClick handler.
   */
  disabledProducts?: DisabledProducts;
  /**
   * Fired when the product selection changes
   */
  onChange?: (params: {
    previousProducts: ProductSolution[];
    products: ProductSolution[];
  }) => void;
  /**
   * Triggered when the component is loaded
   */
  onLoad?: (products: ProductSolution[]) => void;
  /**
   * The platform key of the project (e.g. javascript-react, python-django, etc.)
   */
  platform?: PlatformKey;
};

export function ProductSelection({
  disabledProducts: disabledProductsProp,
  organization,
  platform,
  onChange,
  onLoad,
}: ProductSelectionProps) {
  const [params, setParams] = useOnboardingQueryParams();
  const urlProducts = useMemo(
    () => (params.product ?? []) as ProductSolution[],
    [params.product]
  );

  const products: ProductSolution[] | undefined = platform
    ? platformProductAvailability[platform]
    : undefined;

  const disabledProducts = useMemo(
    () => disabledProductsProp ?? getDisabledProducts(organization),
    [organization, disabledProductsProp]
  );

  // Use useEffectEvent to pass urlProducts without adding it as a dependency
  const initializeProducts = useEffectEvent(() => {
    onLoad?.(urlProducts);
  });

  // Call onLoad once on mount
  useEffect(() => {
    initializeProducts();
  }, []);

  const handleClickProduct = useCallback(
    (product: ProductSolution) => {
      const newProduct = new Set(
        urlProducts.includes(product)
          ? urlProducts.filter(p => p !== product)
          : [...urlProducts, product]
      );

      if (products?.includes(ProductSolution.PROFILING)) {
        // Ensure that if profiling is enabled, tracing is also enabled
        if (
          product === ProductSolution.PROFILING &&
          newProduct.has(ProductSolution.PROFILING)
        ) {
          newProduct.add(ProductSolution.PERFORMANCE_MONITORING);
        } else if (
          product === ProductSolution.PERFORMANCE_MONITORING &&
          !newProduct.has(ProductSolution.PERFORMANCE_MONITORING)
        ) {
          newProduct.delete(ProductSolution.PROFILING);
        }
      }

      const selectedProducts = Array.from(newProduct);

      onChange?.({
        previousProducts: urlProducts,
        products: selectedProducts,
      });
      setParams({product: selectedProducts});
    },
    [products, setParams, urlProducts, onChange]
  );

  if (!products) {
    // if the platform does not support any product, we don't render anything
    return null;
  }

  return (
    <Flex wrap="wrap" gap="md">
      <Product
        label={t('Error Monitoring')}
        disabled={{reason: t("Let's admit it, we all have errors.")}}
        checked
      />
      {products.includes(ProductSolution.LOGS) && (
        <Product
          label={t('Logs')}
          description={t(
            'Structured application logs for debugging and troubleshooting. Automatically gets associated with errors and traces.'
          )}
          docLink="https://docs.sentry.io/product/explore/logs/"
          onClick={() => handleClickProduct(ProductSolution.LOGS)}
          disabled={disabledProducts[ProductSolution.LOGS]}
          checked={urlProducts.includes(ProductSolution.LOGS)}
        />
      )}
      {products.includes(ProductSolution.METRICS) && (
        <Product
          label={t('Metrics')}
          description={t(
            'Custom metrics for tracking application performance and usage, automatically trace-connected.'
          )}
          docLink="https://docs.sentry.io/product/explore/metrics/"
          onClick={() => handleClickProduct(ProductSolution.METRICS)}
          disabled={disabledProducts[ProductSolution.METRICS]}
          checked={urlProducts.includes(ProductSolution.METRICS)}
        />
      )}
      {products.includes(ProductSolution.SESSION_REPLAY) && (
        <Product
          label={t('Session Replay')}
          description={t(
            'Video-like reproductions of user sessions with debugging context to help you confirm issue impact and troubleshoot faster.'
          )}
          docLink="https://docs.sentry.io/product/explore/session-replay/"
          onClick={() => handleClickProduct(ProductSolution.SESSION_REPLAY)}
          disabled={disabledProducts[ProductSolution.SESSION_REPLAY]}
          checked={urlProducts.includes(ProductSolution.SESSION_REPLAY)}
        />
      )}
      {products.includes(ProductSolution.PERFORMANCE_MONITORING) && (
        <Product
          label={t('Tracing')}
          description={t(
            'Automatic performance issue detection across services and context on who is impacted, outliers, regressions, and the root cause of your slowdown.'
          )}
          docLink="https://docs.sentry.io/concepts/key-terms/tracing/"
          onClick={() => handleClickProduct(ProductSolution.PERFORMANCE_MONITORING)}
          disabled={disabledProducts[ProductSolution.PERFORMANCE_MONITORING]}
          checked={urlProducts.includes(ProductSolution.PERFORMANCE_MONITORING)}
        />
      )}
      {products.includes(ProductSolution.PROFILING) && (
        <Product
          label={t('Profiling')}
          description={tct(
            '[strong:Requires Tracing]\nSee the exact lines of code causing your performance bottlenecks, for faster troubleshooting and resource optimization.',
            {
              strong: <strong />,
            }
          )}
          docLink="https://docs.sentry.io/product/explore/profiling/getting-started/#continuous-profiling"
          onClick={() => handleClickProduct(ProductSolution.PROFILING)}
          disabled={disabledProducts[ProductSolution.PROFILING]}
          checked={urlProducts.includes(ProductSolution.PROFILING)}
        />
      )}
    </Flex>
  );
}

const ProductButton = withChonk(
  styled(Button)`
    :hover,
    :focus-visible {
      border: 1px solid ${p => p.theme.purple300};
      background: ${p => p.theme.purple100};
      color: ${p => p.theme.purple300};
    }

    [aria-disabled='true'] {
      input {
        background: ${p => p.theme.purple100};
        color: ${p => p.theme.purple300};
      }
    }
  `,
  Button
);

const ProductButtonInner = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, max-content);
  gap: ${space(1)};
  align-items: center;
`;
