import {Fragment, useCallback, useEffect} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Checkbox from 'sentry/components/checkbox';
import ExternalLink from 'sentry/components/links/externalLink';
import QuestionTooltip from 'sentry/components/questionTooltip';
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
};

export const ProductSelection = ({defaultSelectedProducts}: Props) => {
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
        {tct('In this quick guide you’ll use [npm] or [yarn] to set up:', {
          npm: <strong>npm</strong>,
          yarn: <strong>yarn</strong>,
        })}
      </TextBlock>
      <Products>
        <Product
          disabled
          data-test-id={`product-${PRODUCT.ERROR_MONITORING}-${PRODUCT.PERFORMANCE_MONITORING}-${PRODUCT.SESSION_REPLAY}`}
        >
          <Checkbox checked readOnly size="xs" disabled />
          <div>{t('Error Monitoring')}</div>
          <QuestionTooltip
            size="xs"
            title={
              <TooltipDescription>
                {t(
                  'Detailed views of errors and performance problems in your application grouped by events with a similar set of characteristics.'
                )}
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react/">
                  {t('Read the Docs')}
                </ExternalLink>
              </TooltipDescription>
            }
            isHoverable
          />
        </Product>
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
          <QuestionTooltip
            size="xs"
            title={
              <TooltipDescription>
                {t(
                  'Detailed views of errors and performance problems in your application grouped by events with a similar set of characteristics.'
                )}
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react/">
                  {t('Read the Docs')}
                </ExternalLink>
              </TooltipDescription>
            }
            isHoverable
          />
        </Product>
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
          <QuestionTooltip
            size="xs"
            title={
              <TooltipDescription>
                {t(
                  'Detailed views of errors and performance problems in your application grouped by events with a similar set of characteristics.'
                )}
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/react/">
                  {t('Read the Docs')}
                </ExternalLink>
              </TooltipDescription>
            }
            isHoverable
          />
        </Product>
      </Products>
      <Divider />
    </Fragment>
  );
};

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
  text-align: left;
`;
