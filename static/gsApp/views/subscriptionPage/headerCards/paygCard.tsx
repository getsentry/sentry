import {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {Container, Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import ProgressBar from 'sentry/components/progressBar';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import getDaysSinceDate from 'sentry/utils/getDaysSinceDate';
import {useMutation} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {
  OnDemandBudgetMode,
  type OnDemandBudgets,
  type Subscription,
} from 'getsentry/types';
import {displayBudgetName} from 'getsentry/utils/billing';
import {displayPrice} from 'getsentry/views/amCheckout/utils';
import {openOnDemandBudgetEditModal} from 'getsentry/views/onDemandBudgets/editOnDemandButton';
import {
  getTotalBudget,
  getTotalSpend,
  parseOnDemandBudgetsFromSubscription,
  trackOnDemandBudgetAnalytics,
} from 'getsentry/views/onDemandBudgets/utils';
import {openSpendLimitsPricingModal} from 'getsentry/views/spendLimits/modal';
import SubscriptionHeaderCard from 'getsentry/views/subscriptionPage/headerCards/subscriptionHeaderCard';

function PaygCard({
  subscription,
  organization,
}: {
  organization: Organization;
  subscription: Subscription;
}) {
  const api = useApi();
  const theme = useTheme();
  const paygBudget = parseOnDemandBudgetsFromSubscription(subscription);
  const totalBudget = getTotalBudget(paygBudget);
  const totalSpend = subscription.onDemandBudgets
    ? getTotalSpend(subscription.onDemandBudgets)
    : 0;

  const [isEditing, setIsEditing] = useState(false);
  const [newBudgetDollars, setNewBudgetDollars] = useState<number>(
    Math.ceil(totalBudget / 100)
  );
  const [error, setError] = useState<string | null>(null);

  const {mutate: handleSubmit} = useMutation({
    mutationFn: () => {
      return api.requestPromise(`/customers/${organization.slug}/ondemand-budgets/`, {
        method: 'POST',
        data: {
          budgetMode: OnDemandBudgetMode.SHARED,
          sharedMaxBudget: newBudgetDollars * 100, // convert to cents
        },
      });
    },
    onSuccess: (_data: OnDemandBudgets) => {
      trackOnDemandBudgetAnalytics(organization, paygBudget, _data, 'payg_inline_form');
      SubscriptionStore.loadData(subscription.slug);
      setIsEditing(false);
    },
    onError: err => {
      setError(err.message);
    },
  });

  const formattedTotalBudget = displayPrice({cents: totalBudget});
  const formattedTotalSpend = displayPrice({cents: totalSpend});
  const daysLeft =
    -1 *
    getDaysSinceDate(
      moment(subscription.onDemandPeriodEnd).add(1, 'days').format('YYYY-MM-DD')
    );
  const isLegacy = subscription.planDetails.hasOnDemandModes;

  return (
    <SubscriptionHeaderCard
      title={
        isEditing
          ? tct('Edit [budgetTerm] limit', {
              budgetTerm: displayBudgetName(subscription.planDetails),
            })
          : undefined
      }
      sections={
        isEditing
          ? [
              <Flex key="payg-form" direction="column" gap="xl" width="100%">
                {error && (
                  <Alert type="error" key="error">
                    {error}
                  </Alert>
                )}
                <Currency>
                  <StyledInput
                    aria-label={t(
                      'Edit %s limit',
                      displayBudgetName(subscription.planDetails)
                    )}
                    size="sm"
                    type="number"
                    value={newBudgetDollars}
                    min={0}
                    onChange={e => setNewBudgetDollars(parseInt(e.target.value, 10) || 0)}
                  />
                </Currency>
                <Flex justify="between" align="center">
                  <Flex gap="sm" align="center">
                    <Button priority="primary" onClick={() => handleSubmit()}>
                      {t('Save')}
                    </Button>
                    <Button
                      onClick={() => {
                        // reset the budget to the current total budget
                        setNewBudgetDollars(Math.ceil(totalBudget / 100));
                        setIsEditing(false);
                      }}
                    >
                      {t('Cancel')}
                    </Button>
                  </Flex>
                  <Button
                    priority="link"
                    onClick={() =>
                      openSpendLimitsPricingModal({organization, subscription, theme})
                    }
                  >
                    {tct('[budgetTerm] pricing', {
                      budgetTerm: displayBudgetName(subscription.planDetails, {
                        abbreviated: true,
                      }),
                    })}
                  </Button>
                </Flex>
              </Flex>,
            ]
          : [
              <Flex justify="between" align="start" key="title" width="100%">
                <Heading as="h2" size="lg">
                  {displayBudgetName(subscription.planDetails, {title: true})}
                </Heading>
                <Button
                  size="xs"
                  onClick={() => {
                    if (isLegacy) {
                      openOnDemandBudgetEditModal({organization, subscription, theme});
                    } else {
                      setIsEditing(true);
                    }
                  }}
                >
                  {totalBudget > 0 ? t('Edit limit') : t('Set limit')}
                </Button>
              </Flex>,
              <Container key="payg-budget">
                <Text size="xl" bold>
                  {formattedTotalSpend}
                </Text>
              </Container>,
              <UsageBar
                key="usage-bar"
                totalBudget={totalBudget}
                totalSpend={totalSpend}
              />,
              <Flex key="subtext" justify="between" align="center" width="100%">
                <Text size="sm" variant="muted">
                  {tct('Resets in [daysLeft] days', {daysLeft})}
                </Text>
                <Text size="sm" variant="muted">
                  {tct('[formattedTotalBudget] limit[note]', {
                    formattedTotalBudget,
                    note:
                      paygBudget.budgetMode === OnDemandBudgetMode.PER_CATEGORY
                        ? t(' (combined total)')
                        : '',
                  })}
                </Text>
              </Flex>,
            ]
      }
    />
  );
}

function UsageBar({totalBudget, totalSpend}: {totalBudget: number; totalSpend: number}) {
  const percentUsed = totalBudget > 0 ? Math.round((totalSpend / totalBudget) * 100) : 0;

  return <ProgressBar value={percentUsed} variant="small" />;
}

export default PaygCard;

const Currency = styled('div')`
  &::before {
    position: absolute;
    padding: 9px ${p => p.theme.space.xl} ${p => p.theme.space.md};
    content: '$';
    color: ${p => p.theme.subText};
    font-size: ${p => p.theme.fontSize.sm};
    font-weight: bold;
  }
`;

const StyledInput = styled(Input)`
  padding-left: ${p => p.theme.space['3xl']};
  font-weight: bold;
`;
