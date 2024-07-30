import {useEffect} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import waitingForSpansImg from 'sentry-images/spot/performance-waiting-for-span.svg';

import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';

import {traceAnalytics} from '../traceAnalytics';
import type {TraceTree} from '../traceModels/traceTree';

import {TraceWarningComponents} from './styles';
import {useTransactionUsageStats} from './useTransactionUsageStats';

type Props = {
  organization: Organization;
  traceSlug: string | undefined;
  tree: TraceTree;
};

type Subscription = {
  categories: {
    transactions: {
      usageExceeded: boolean;
    };
  };
  planDetails: {
    hasOnDemandModes: boolean;
  };
};

function GenericWarnings(props: Props) {
  const {data: transactionUsageStats} = useTransactionUsageStats({
    organization: props.organization,
    tree: props.tree,
  });

  const {data: subscription} = useApiQuery<Subscription>(
    [`/subscriptions/${props.organization.slug}/`],
    {
      staleTime: Infinity,
    }
  );

  // Check if events were dropped due to exceeding the transaction quota, around when the trace occurred.
  const droppedTransactionsCount = transactionUsageStats?.totals['sum(quantity)'] || 0;

  // Check if the organization still has transaction quota maxed out.
  const hasExceededTransactionLimit =
    subscription?.categories.transactions.usageExceeded || false;

  const hideBanner =
    props.tree.type !== 'trace' ||
    droppedTransactionsCount === 0 ||
    !hasExceededTransactionLimit;

  useEffect(() => {
    if (hideBanner) {
      return;
    }

    traceAnalytics.trackQuotaExceededBannerLoaded(props.organization, props.tree.shape);
  }, [hideBanner, props.organization, props.tree.shape]);

  if (hideBanner) {
    return null;
  }

  const title = subscription?.planDetails?.hasOnDemandModes
    ? t("You've exceeded your monthly pay-as-you-go budget")
    : t("You've exceeded your monthly quota");
  const ctaText = subscription?.planDetails?.hasOnDemandModes
    ? t('Increase Budget')
    : t('Set Budget');

  return (
    <Wrapper>
      <TraceWarningComponents.Banner
        localStorageKey={`${props.traceSlug}:transaction-usage-warning-banner-hide`}
        organization={props.organization}
        image={waitingForSpansImg}
        title={title}
        description={t(
          'Spans are being dropped and monitoring is impacted. To start seeing traces associated with errors, increase your budget.'
        )}
        onSecondaryButtonClick={() => {
          traceAnalytics.trackQuotaExceededLearnMoreClicked(
            props.organization,
            props.tree.shape
          );
        }}
        onPrimaryButtonClick={() => {
          traceAnalytics.trackQuotaExceededIncreaseBudgetClicked(
            props.organization,
            props.tree.shape
          );
          browserHistory.push({
            pathname: `/settings/billing/checkout/`,
            query: {
              skipBundles: true,
            },
          });
        }}
        docsRoute="https://docs.sentry.io/pricing/quotas/"
        primaryButtonText={ctaText}
      />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  ${TraceWarningComponents.BannerBackground} {
    top: 4px;
    right: 40px;
    height: 98%;
    width: 100%;
    max-width: 270px;
  }
`;

export default GenericWarnings;
