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

export enum PRODUCT {
  ERROR_MONITORING = 'error-monitoring',
  PERFORMANCE_MONITORING = 'performance-monitoring',
  SESSION_REPLAY = 'session-replay',
}

export type DisabledProduct = {
  product: PRODUCT;
  reason: string;
  onClick?: () => void;
};

type ProductProps = {
  checked: boolean;
  disabled: boolean;
  label: string;
  onClick?: () => void;
  permanentDisabled?: boolean;
};

function Product({disabled, permanentDisabled, checked, label, onClick}: ProductProps) {
  const ProductWrapper = permanentDisabled
    ? PermanentDisabledProductWrapper
    : disabled
    ? DisabledProductWrapper
    : ProductButtonWrapper;

  return (
    <ProductWrapper
      onClick={onClick}
      disabled={onClick ?? permanentDisabled ? false : disabled}
      priority={permanentDisabled || checked ? 'primary' : 'default'}
      aria-label={label}
    >
      <ProductButtonInner>
        <Checkbox
          checked={checked}
          disabled={permanentDisabled ? false : disabled}
          aria-label={label}
          size="xs"
          readOnly
        />
        <span>{label}</span>
        <IconQuestion size="xs" color="subText" />
      </ProductButtonInner>
    </ProductWrapper>
  );
}

export type ProductSelectionProps = {
  defaultSelectedProducts?: PRODUCT[];
  disabledProducts?: DisabledProduct[];
  lazyLoader?: boolean;
  skipLazyLoader?: () => void;
};

export function ProductSelection({
  defaultSelectedProducts,
  disabledProducts,
  lazyLoader,
  skipLazyLoader,
}: ProductSelectionProps) {
  const router = useRouter();
  const products = decodeList(router.location.query.product);

  useEffect(() => {
    if (!defaultSelectedProducts) {
      return;
    }
    router.replace({
      pathname: router.location.pathname,
      query: {
        ...router.location.query,
        product: defaultSelectedProducts,
      },
    });
    // Adding defaultSelectedProducts to the dependency array causes an max-depth error
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const handleClickProduct = useCallback(
    (product: PRODUCT) => {
      router.replace({
        pathname: router.location.pathname,
        query: {
          ...router.location.query,
          product: products.includes(product)
            ? products.filter(p => p !== product)
            : [...products, product],
        },
      });
    },
    [router, products]
  );

  const performanceProductDisabled = disabledProducts?.find(
    disabledProduct => disabledProduct.product === PRODUCT.PERFORMANCE_MONITORING
  );

  const sessionReplayProductDisabled = disabledProducts?.find(
    disabledProduct => disabledProduct.product === PRODUCT.SESSION_REPLAY
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
        <Tooltip title={t("Let's admit it, we all have errors.")}>
          <Product disabled checked permanentDisabled label={t('Error Monitoring')} />
        </Tooltip>
        <Tooltip
          title={
            performanceProductDisabled?.reason ?? (
              <TooltipDescription>
                {t(
                  'Automatic performance issue detection with context like who it impacts and the release, line of code, or function causing the slowdown.'
                )}
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react/performance/">
                  {t('Read the Docs')}
                </ExternalLink>
              </TooltipDescription>
            )
          }
          isHoverable
        >
          <Product
            onClick={
              performanceProductDisabled
                ? performanceProductDisabled?.onClick
                : () => handleClickProduct(PRODUCT.PERFORMANCE_MONITORING)
            }
            disabled={!!performanceProductDisabled}
            checked={products.includes(PRODUCT.PERFORMANCE_MONITORING)}
            label={t('Performance Monitoring')}
          />
        </Tooltip>
        <Tooltip
          title={
            sessionReplayProductDisabled?.reason ?? (
              <TooltipDescription>
                {t(
                  'Video-like reproductions of user sessions with debugging context to help you confirm issue impact and troubleshoot faster.'
                )}
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react/session-replay/">
                  {t('Read the Docs')}
                </ExternalLink>
              </TooltipDescription>
            )
          }
          isHoverable
        >
          <Product
            onClick={
              sessionReplayProductDisabled
                ? sessionReplayProductDisabled?.onClick
                : () => handleClickProduct(PRODUCT.SESSION_REPLAY)
            }
            disabled={!!sessionReplayProductDisabled}
            checked={products.includes(PRODUCT.SESSION_REPLAY)}
            label={t('Session Replay')}
          />
        </Tooltip>
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
