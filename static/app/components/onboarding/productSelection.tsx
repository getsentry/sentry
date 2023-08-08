import {Fragment, useCallback, useEffect} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Checkbox from 'sentry/components/checkbox';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {IconQuestion} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {decodeList} from 'sentry/utils/queryString';
import useRouter from 'sentry/utils/useRouter';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

export enum ProductSolution {
  ERROR_MONITORING = 'error-monitoring',
  PERFORMANCE_MONITORING = 'performance-monitoring',
  SESSION_REPLAY = 'session-replay',
}

export type DisabledProduct = {
  reason: string;
  onClick?: () => void;
  product?: ProductSolution;
};

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
  description?: string;
  /**
   * If the product is disabled. It contains a reason and an optional onClick handler
   */
  disabled?: DisabledProduct;
  /**
   * Link of the product documentation. Rendered if there is also a description.
   */
  docLink?: string;
  /**
   * Click handler. If the product is enablec, by clicking on the button, the product is added or removed from the URL.
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
   * List of products to display
   */
  products: ProductSolution[];
  /**
   * List of products that are checked by default
   */
  defaultSelectedProducts?: ProductSolution[];
  /**
   * List of products that are disabled. All of them have to contain a reason by default and optionally an onClick handler.
   */
  disabledProducts?: DisabledProduct[];
  /**
   * If true, the loader script is used instead of the npm/yarn guide.
   */
  lazyLoader?: boolean;
  skipLazyLoader?: () => void;
};

export function ProductSelection({
  defaultSelectedProducts,
  disabledProducts,
  lazyLoader,
  skipLazyLoader,
  products,
}: ProductSelectionProps) {
  const router = useRouter();
  const urlProducts = decodeList(router.location.query.product);

  const defaultProducts = defaultSelectedProducts
    ? defaultSelectedProducts.filter(defaultSelectedProduct =>
        products.includes(defaultSelectedProduct)
      )
    : products;

  useEffect(() => {
    router.replace({
      pathname: router.location.pathname,
      query: {
        ...router.location.query,
        product: defaultProducts,
      },
    });
    // Adding defaultSelectedProducts to the dependency array causes an max-depth error
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleClickProduct = useCallback(
    (product: ProductSolution) => {
      router.replace({
        pathname: router.location.pathname,
        query: {
          ...router.location.query,
          product: urlProducts.includes(product)
            ? urlProducts.filter(p => p !== product)
            : [...urlProducts, product],
        },
      });
    },
    [router, urlProducts]
  );

  return (
    <Fragment>
      <TextBlock>
        {lazyLoader
          ? tct('In this quick guide you’ll use our [loaderScript] to set up:', {
              loaderScript: <strong>Loader Script</strong>,
            })
          : tct('In this quick guide you’ll use [npm] or [yarn] to set up:', {
              npm: <strong>npm</strong>,
              yarn: <strong>yarn</strong>,
            })}
      </TextBlock>
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
              'Automatic performance issue detection with context like who it impacts and the release, line of code, or function causing the slowdown.'
            )}
            docLink="https://docs.sentry.io/platforms/javascript/guides/react/performance/"
            onClick={() => handleClickProduct(ProductSolution.PERFORMANCE_MONITORING)}
            disabled={disabledProducts?.find(
              disabledProduct =>
                disabledProduct.product === ProductSolution.PERFORMANCE_MONITORING
            )}
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
            disabled={disabledProducts?.find(
              disabledProduct =>
                disabledProduct.product === ProductSolution.SESSION_REPLAY
            )}
            checked={urlProducts.includes(ProductSolution.SESSION_REPLAY)}
          />
        )}
      </Products>
      {lazyLoader && (
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
      <Divider />
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

const Divider = styled('hr')`
  height: 1px;
  width: 100%;
  background: ${p => p.theme.border};
  border: none;
`;

const TooltipDescription = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
  justify-content: flex-start;
`;

const AlternativeInstallationAlert = styled(Alert)`
  margin-top: ${space(3)};
`;
