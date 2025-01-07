import type {ReactNode} from 'react';
import {useCallback, useEffect, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {FeatureDisabledModal} from 'sentry/components/acl/featureDisabledModal';
import {Button} from 'sentry/components/button';
import Checkbox from 'sentry/components/checkbox';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import HookStore from 'sentry/stores/hookStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/project';
import {useOnboardingQueryParams} from 'sentry/views/onboarding/components/useOnboardingQueryParams';

// TODO(aknaus): move to types
export enum ProductSolution {
  ERROR_MONITORING = 'error-monitoring',
  PERFORMANCE_MONITORING = 'performance-monitoring',
  SESSION_REPLAY = 'session-replay',
  PROFILING = 'profiling',
}

interface DisabledProduct {
  reason: ReactNode;
  onClick?: () => void;
}

export type DisabledProducts = Partial<Record<ProductSolution, DisabledProduct>>;

function getDisabledProducts(organization: Organization): DisabledProducts {
  const disabledProducts: DisabledProducts = {};
  const hasSessionReplay = organization.features.includes('session-replay');
  const hasPerformance = organization.features.includes('performance-view');
  const hasProfiling = organization.features.includes('profiling-view');
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
      .reduce((acc, prod) => {
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
  return disabledProducts;
}

// This is the list of products that are available for each platform
// Since the ProductSelection component is rendered in the onboarding/project creation flow only, it is ok to have this list here
// NOTE: Please keep the prefix in alphabetical order
export const platformProductAvailability = {
  android: [ProductSolution.PERFORMANCE_MONITORING],
  'apple-ios': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'apple-macos': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  bun: [ProductSolution.PERFORMANCE_MONITORING],
  capacitor: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.SESSION_REPLAY],
  dotnet: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'dotnet-aspnet': [ProductSolution.PERFORMANCE_MONITORING],
  'dotnet-aspnetcore': [ProductSolution.PERFORMANCE_MONITORING],
  'dotnet-awslambda': [ProductSolution.PERFORMANCE_MONITORING],
  'dotnet-gcpfunctions': [ProductSolution.PERFORMANCE_MONITORING],
  'dotnet-maui': [ProductSolution.PERFORMANCE_MONITORING],
  'dotnet-uwp': [ProductSolution.PERFORMANCE_MONITORING],
  'dotnet-winforms': [ProductSolution.PERFORMANCE_MONITORING],
  'dotnet-wpf': [ProductSolution.PERFORMANCE_MONITORING],
  'dotnet-xamarin': [ProductSolution.PERFORMANCE_MONITORING],
  flutter: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  kotlin: [ProductSolution.PERFORMANCE_MONITORING],
  go: [ProductSolution.PERFORMANCE_MONITORING],
  'go-echo': [ProductSolution.PERFORMANCE_MONITORING],
  'go-fasthttp': [ProductSolution.PERFORMANCE_MONITORING],
  'go-gin': [ProductSolution.PERFORMANCE_MONITORING],
  'go-http': [ProductSolution.PERFORMANCE_MONITORING],
  'go-iris': [ProductSolution.PERFORMANCE_MONITORING],
  'go-martini': [ProductSolution.PERFORMANCE_MONITORING],
  'go-negroni': [ProductSolution.PERFORMANCE_MONITORING],
  ionic: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.SESSION_REPLAY],
  java: [ProductSolution.PERFORMANCE_MONITORING],
  'java-log4j2': [ProductSolution.PERFORMANCE_MONITORING],
  'java-logback': [ProductSolution.PERFORMANCE_MONITORING],
  'java-spring': [ProductSolution.PERFORMANCE_MONITORING],
  'java-spring-boot': [ProductSolution.PERFORMANCE_MONITORING],
  javascript: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.SESSION_REPLAY],
  'javascript-react': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  'javascript-vue': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  'javascript-angular': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  'javascript-ember': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  'javascript-gatsby': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  'javascript-solid': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  'javascript-solidstart': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  'javascript-svelte': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  'javascript-astro': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  node: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'node-azurefunctions': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
  ],
  'node-awslambda': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'node-connect': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'node-express': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'node-fastify': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'node-gcpfunctions': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
  ],
  'node-hapi': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'node-koa': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'node-nestjs': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  php: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'php-laravel': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  ['php-symfony']: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  python: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-aiohttp': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-asgi': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-awslambda': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-bottle': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-celery': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-chalice': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-django': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-falcon': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-fastapi': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-flask': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-gcpfunctions': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
  ],
  'python-quart': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-rq': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-serverless': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
  ],
  'python-tornado': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-starlette': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-wsgi': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'react-native': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  ruby: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'ruby-rack': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'ruby-rails': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
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
  /**
   * A permanent disabled product is always disabled and cannot be enabled.
   */
  permanentDisabled?: boolean;
};

function Product({
  disabled,
  permanentDisabled,
  checked,
  label,
  onClick,
  docLink,
  description,
}: ProductProps) {
  const ProductWrapper = permanentDisabled
    ? PermanentDisabledProductWrapper
    : disabled
      ? DisabledProductWrapper
      : ProductButtonWrapper;

  return (
    <Tooltip
      title={
        disabled?.reason ??
        (description && (
          <TooltipDescription>
            {description}
            {docLink && <ExternalLink href={docLink}>{t('Read the Docs')}</ExternalLink>}
          </TooltipDescription>
        ))
      }
      delay={500}
      isHoverable
    >
      <ProductWrapper
        onClick={disabled?.onClick ?? onClick}
        disabled={disabled?.onClick ?? permanentDisabled ? false : !!disabled}
        priority={permanentDisabled || checked ? 'primary' : 'default'}
        aria-label={label}
      >
        <ProductButtonInner>
          <Checkbox
            checked={checked}
            disabled={permanentDisabled ? false : !!disabled}
            aria-label={label}
            size="xs"
            readOnly
          />
          <span>{label}</span>
          <IconQuestion size="xs" color="subText" />
        </ProductButtonInner>
      </ProductWrapper>
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
  onChange?: (products: ProductSolution[]) => void;
  /**
   * Triggered when the component is loaded
   */
  onLoad?: (products: ProductSolution[]) => void;
  /**
   * The platform key of the project (e.g. javascript-react, python-django, etc.)
   */
  platform?: PlatformKey;
  /**
   * A custom list of products per platform. If not provided, the default list is used.
   */
  productsPerPlatform?: Record<PlatformKey, ProductSolution[]>;
};

export function ProductSelection({
  disabledProducts: disabledProductsProp,
  organization,
  platform,
  productsPerPlatform = platformProductAvailability,
  onChange,
  onLoad,
}: ProductSelectionProps) {
  const [params, setParams] = useOnboardingQueryParams();
  const urlProducts = useMemo(() => params.product ?? [], [params.product]);

  const products: ProductSolution[] | undefined = platform
    ? productsPerPlatform[platform]
    : undefined;

  const disabledProducts = useMemo(
    () => disabledProductsProp ?? getDisabledProducts(organization),
    [organization, disabledProductsProp]
  );
  const defaultProducts = useMemo(() => {
    return products?.filter(product => !(product in disabledProducts)) ?? [];
  }, [products, disabledProducts]);

  useEffect(() => {
    onLoad?.(defaultProducts);
    setParams({
      product: defaultProducts,
    });
    // Adding defaultProducts to the dependency array causes an max-depth error
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClickProduct = useCallback(
    (product: ProductSolution) => {
      const newProduct = new Set(
        urlProducts.includes(product)
          ? urlProducts.filter(p => p !== product)
          : [...urlProducts, product]
      );

      if (defaultProducts?.includes(ProductSolution.PROFILING)) {
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

      const selectedProducts = [...newProduct] as ProductSolution[];

      onChange?.(selectedProducts);
      setParams({product: selectedProducts});

      if (organization.features.includes('project-create-replay-feedback')) {
        HookStore.get('callback:on-create-project-product-selection').map(cb =>
          cb({defaultProducts, organization, selectedProducts})
        );
      }
    },
    [defaultProducts, organization, setParams, urlProducts, onChange]
  );

  if (!products) {
    // if the platform does not support any product, we don't render anything
    return null;
  }

  return (
    <Products>
      <Product
        label={t('Error Monitoring')}
        disabled={{reason: t("Let's admit it, we all have errors.")}}
        checked
        permanentDisabled
      />
      {products.includes(ProductSolution.PERFORMANCE_MONITORING) && (
        <Product
          label={t('Tracing')}
          description={t(
            'Automatic performance issue detection across services and context on who is impacted, outliers, regressions, and the root cause of your slowdown.'
          )}
          docLink="https://docs.sentry.io/platforms/javascript/guides/react/tracing/"
          onClick={() => handleClickProduct(ProductSolution.PERFORMANCE_MONITORING)}
          disabled={disabledProducts[ProductSolution.PERFORMANCE_MONITORING]}
          checked={urlProducts.includes(ProductSolution.PERFORMANCE_MONITORING)}
        />
      )}
      {products.includes(ProductSolution.SESSION_REPLAY) && (
        <Product
          label={t('Session Replay')}
          description={t(
            'Video-like reproductions of user sessions with debugging context to help you confirm issue impact and troubleshoot faster.'
          )}
          docLink="https://docs.sentry.io/platforms/javascript/guides/react/session-replay/"
          onClick={() => handleClickProduct(ProductSolution.SESSION_REPLAY)}
          disabled={disabledProducts[ProductSolution.SESSION_REPLAY]}
          checked={urlProducts.includes(ProductSolution.SESSION_REPLAY)}
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
          docLink="https://docs.sentry.io/platforms/python/profiling/"
          onClick={() => handleClickProduct(ProductSolution.PROFILING)}
          disabled={disabledProducts[ProductSolution.PROFILING]}
          checked={urlProducts.includes(ProductSolution.PROFILING)}
        />
      )}
    </Products>
  );
}

const Products = styled('div')`
  display: flex;
  flex-wrap: wrap;
  gap: ${space(1)};
`;

const ProductButtonWrapper = styled(Button)`
  ${p =>
    p.priority === 'primary' &&
    css`
      &,
      :hover {
        background: ${p.theme.purple100};
        color: ${p.theme.purple300};
      }
    `}
`;

const DisabledProductWrapper = styled(Button)`
  && {
    cursor: ${p => (p.disabled ? 'not-allowed' : 'pointer')};
    input {
      cursor: ${p =>
        p.disabled || p.priority === 'default' ? 'not-allowed' : 'pointer'};
    }
  }
`;

const PermanentDisabledProductWrapper = styled(Button)`
  && {
    &,
    :hover {
      background: ${p => p.theme.purple100};
      color: ${p => p.theme.purple300};
      opacity: 0.5;
      cursor: not-allowed;
      input {
        cursor: not-allowed;
      }
    }
  }
`;

const ProductButtonInner = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, max-content);
  gap: ${space(1)};
  align-items: center;
`;

const TooltipDescription = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  justify-content: flex-start;
`;
