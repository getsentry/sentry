import {Fragment, ReactNode, useCallback, useEffect, useMemo} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openModal} from 'sentry/actionCreators/modal';
import {FeatureDisabledModal} from 'sentry/components/acl/featureDisabledModal';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Checkbox from 'sentry/components/checkbox';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PlatformKey} from 'sentry/types';
import {Organization} from 'sentry/types';
import {decodeList} from 'sentry/utils/queryString';
import useRouter from 'sentry/utils/useRouter';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

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

  const reason = t('This feature is not enabled on your Sentry installation.');
  const createClickHandler = (feature: string, featureName: string) => () => {
    openModal(deps => (
      <FeatureDisabledModal {...deps} features={[feature]} featureName={featureName} />
    ));
  };

  if (!hasSessionReplay) {
    disabledProducts[ProductSolution.SESSION_REPLAY] = {
      reason,
      onClick: createClickHandler('organizations:session-replay', 'Session Replay'),
    };
  }
  if (!hasPerformance) {
    disabledProducts[ProductSolution.PERFORMANCE_MONITORING] = {
      reason,
      onClick: createClickHandler(
        'organizations:performance-view',
        'Performance Monitoring'
      ),
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
  android: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  bun: [ProductSolution.PERFORMANCE_MONITORING],
  kotlin: [ProductSolution.PERFORMANCE_MONITORING],
  java: [ProductSolution.PERFORMANCE_MONITORING],
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
  capacitor: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.SESSION_REPLAY],
  'javascript-ember': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.SESSION_REPLAY,
  ],
  'javascript-gatsby': [
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
  'node-gcpfunctions': [
    ProductSolution.PERFORMANCE_MONITORING,
    ProductSolution.PROFILING,
  ],
  'node-koa': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  php: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'php-laravel': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  ['php-symfony']: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  python: [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-aiohttp': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-asgi': [ProductSolution.PERFORMANCE_MONITORING],
  'python-awslambda': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-bottle': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
  'python-celery': [ProductSolution.PERFORMANCE_MONITORING, ProductSolution.PROFILING],
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
   * If true, the loader script is used instead of the npm/yarn guide.
   */
  lazyLoader?: boolean;
  /**
   * The platform key of the project (e.g. javascript-react, python-django, etc.)
   */
  platform?: PlatformKey;
  /**
   * A custom list of products per platform. If not provided, the default list is used.
   */
  productsPerPlatform?: Record<PlatformKey, ProductSolution[]>;
  skipLazyLoader?: () => void;
  /**
   * If true, the component has a bottom margin of 20px
   */
  withBottomMargin?: boolean;
};

export function ProductSelection({
  disabledProducts: disabledProductsProp,
  lazyLoader,
  organization,
  platform,
  productsPerPlatform = platformProductAvailability,
  skipLazyLoader,
}: ProductSelectionProps) {
  const router = useRouter();
  const urlProducts = decodeList(router.location.query.product);
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
    router.replace({
      pathname: router.location.pathname,
      query: {
        ...router.location.query,
        product: defaultProducts,
      },
    });
    // Adding defaultProducts to the dependency array causes an max-depth error
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleClickProduct = useCallback(
    (product: ProductSolution) => {
      const newProduct = new Set(
        urlProducts.includes(product)
          ? urlProducts.filter(p => p !== product)
          : [...urlProducts, product]
      );

      if (defaultProducts?.includes(ProductSolution.PROFILING)) {
        // Ensure that if profiling is enabled, performance monitoring is also enabled
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

      router.replace({
        pathname: router.location.pathname,
        query: {
          ...router.location.query,
          product: [...newProduct],
        },
      });
    },
    [router, urlProducts, defaultProducts]
  );

  if (!products) {
    // if the platform does not support any product, we don't render anything
    return null;
  }

  // TODO(aknaus): clean up
  // The package manager info is only shown for javascript platforms
  // until we improve multi snippet suppport
  const showPackageManagerInfo =
    (platform?.indexOf('javascript') === 0 || platform?.indexOf('node') === 0) &&
    platform !== 'javascript-astro';

  const showAstroInfo = platform === 'javascript-astro';

  return (
    <Fragment>
      {showPackageManagerInfo && (
        <TextBlock noMargin>
          {lazyLoader
            ? tct('In this quick guide you’ll use our [loaderScript] to set up:', {
                loaderScript: <strong>Loader Script</strong>,
              })
            : tct('In this quick guide you’ll use [npm] or [yarn] to set up:', {
                npm: <strong>npm</strong>,
                yarn: <strong>yarn</strong>,
              })}
        </TextBlock>
      )}
      {showAstroInfo && (
        <TextBlock noMargin>
          {tct("In this quick guide you'll use the [astrocli:astro] CLI to set up:", {
            astrocli: <strong />,
          })}
        </TextBlock>
      )}
      <Products>
        <Product
          label={t('Error Monitoring')}
          disabled={{reason: t("Let's admit it, we all have errors.")}}
          checked
          permanentDisabled
        />
        {products.includes(ProductSolution.PERFORMANCE_MONITORING) && (
          <Product
            label={t('Performance Monitoring')}
            description={t(
              'Automatic performance issue detection across services and context on who is impacted, outliers, regressions, and the root cause of your slowdown.'
            )}
            docLink="https://docs.sentry.io/platforms/javascript/guides/react/performance/"
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
              '[strong:Requires Performance Monitoring]\nSee the exact lines of code causing your performance bottlenecks, for faster troubleshooting and resource optimization.',
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
      {showPackageManagerInfo && lazyLoader && (
        <AlternativeInstallationAlert type="info" showIcon>
          {tct('Prefer to set up Sentry using [npm:npm] or [yarn:yarn]? [goHere].', {
            npm: <strong />,
            yarn: <strong />,
            goHere: (
              <Button onClick={skipLazyLoader} priority="link">
                {t('Go here')}
              </Button>
            ),
          })}
        </AlternativeInstallationAlert>
      )}
    </Fragment>
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

const AlternativeInstallationAlert = styled(Alert)`
  margin-bottom: 0px;
`;
