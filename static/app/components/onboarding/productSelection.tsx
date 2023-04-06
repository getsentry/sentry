import {Fragment, useCallback, useEffect} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Checkbox from 'sentry/components/checkbox';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
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

type Props = {
  defaultSelectedProducts?: PRODUCT[];
  lazyLoader?: boolean;
  skipLazyLoader?: () => void;
};

export function ProductSelection({
  defaultSelectedProducts,
  lazyLoader,
  skipLazyLoader,
}: Props) {
  const router = useRouter();
  const products = decodeList(router.location.query.product);

  useEffect(() => {
    if (!defaultSelectedProducts) {
      return;
    }
    router.push({
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
      router.push({
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
          <Product
            disabled
            data-test-id={`product-${PRODUCT.ERROR_MONITORING}-${PRODUCT.PERFORMANCE_MONITORING}-${PRODUCT.SESSION_REPLAY}`}
          >
            <Checkbox checked readOnly size="xs" disabled />
            <div>{t('Error Monitoring')}</div>
          </Product>
        </Tooltip>
        <Tooltip
          title={
            <TooltipDescription>
              {t(
                'Automatic performance issue detection with context like who it impacts and the release, line of code, or function causing the slowdown.'
              )}
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react/performance/">
                {t('Read the Docs')}
              </ExternalLink>
            </TooltipDescription>
          }
          isHoverable
        >
          <Product
            onClick={() => handleClickProduct(PRODUCT.PERFORMANCE_MONITORING)}
            data-test-id={`product-${PRODUCT.PERFORMANCE_MONITORING}`}
          >
            <Checkbox
              checked={products.includes(PRODUCT.PERFORMANCE_MONITORING)}
              size="xs"
              readOnly
            />
            {t('Performance Monitoring')}
          </Product>
        </Tooltip>
        <Tooltip
          title={
            <TooltipDescription>
              {t(
                'Video-like reproductions of user sessions with debugging context to help you confirm issue impact and troubleshoot faster.'
              )}
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react/session-replay/">
                {t('Read the Docs')}
              </ExternalLink>
            </TooltipDescription>
          }
          isHoverable
        >
          <Product
            onClick={() => handleClickProduct(PRODUCT.SESSION_REPLAY)}
            data-test-id={`product-${PRODUCT.SESSION_REPLAY}`}
          >
            <Checkbox
              checked={products.includes(PRODUCT.SESSION_REPLAY)}
              size="xs"
              readOnly
            />
            {t('Session Replay')}
          </Product>
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

const Product = styled('div')<{disabled?: boolean}>`
  display: grid;
  grid-template-columns: repeat(3, max-content);
  gap: ${space(1)};
  align-items: center;
  ${p => p.theme.buttonPadding.xs};
  background: ${p => p.theme.purple100};
  border: 1px solid ${p => p.theme.purple300};
  border-radius: 6px;
  cursor: pointer;
  ${p =>
    p.disabled &&
    css`
      > *:not(:last-child) {
        opacity: 0.5;
      }
    `};
`;

const Divider = styled('hr')`
  border-top-color: ${p => p.theme.border};
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
