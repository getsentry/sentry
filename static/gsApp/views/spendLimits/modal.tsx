import {css, type Theme} from '@emotion/react';

import {openModal} from 'sentry/actionCreators/modal';
import {Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';

import type {Subscription} from 'getsentry/types';
import {displayBudgetName} from 'getsentry/utils/billing';
import {SharedSpendLimitPriceTable} from 'getsentry/views/spendLimits/spendLimitSettings';

function SpendLimitsPricingModal({
  subscription,
  organization,
}: {
  organization: Organization;
  subscription: Subscription;
}) {
  const addOnDataCategories = Object.values(subscription.addOns ?? {}).flatMap(
    addOn => addOn.dataCategories
  );
  const includedAddOns = Object.values(subscription.addOns ?? {})
    .filter(addOn => addOn.enabled)
    .map(addOn => addOn.apiName);
  const currentReserved = Object.fromEntries(
    Object.entries(subscription.categories)
      .filter(([category]) => !addOnDataCategories.includes(category as DataCategory))
      .map(([category, categoryInfo]) => [category, categoryInfo.reserved ?? 0])
  );
  return (
    <Flex direction="column" gap="xl">
      <Heading as="h2">
        {tct('[budgetTerm] pricing', {
          budgetTerm: displayBudgetName(subscription.planDetails, {title: true}),
        })}
      </Heading>
      <Text variant="muted">
        {tct(
          "[budgetTerm] lets you go beyond what's included in your plan. It applies across all products on a first-come, first-served basis, and you're only charged for what you use -- if your monthly usage stays within your plan, you won't pay extra.",
          {
            budgetTerm: displayBudgetName(subscription.planDetails, {title: true}),
          }
        )}
      </Text>
      <SharedSpendLimitPriceTable
        organization={organization}
        activePlan={subscription.planDetails}
        includedAddOns={includedAddOns}
        currentReserved={currentReserved}
      />
    </Flex>
  );
}

export function openSpendLimitsPricingModal({
  subscription,
  organization,
  theme,
}: {
  organization: Organization;
  subscription: Subscription;
  theme: Theme;
}) {
  openModal(
    modalProps => (
      <SpendLimitsPricingModal
        {...modalProps}
        organization={organization}
        subscription={subscription}
      />
    ),
    {
      modalCss: modalCss(theme),
    }
  );
}

const modalCss = (theme: Theme) => css`
  @media (min-width: ${theme.breakpoints.md}) {
    width: 850px;
  }
`;
