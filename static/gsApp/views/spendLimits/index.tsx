import {Container} from 'sentry/components/core/layout';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import {capitalize} from 'sentry/utils/string/capitalize';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import useSubscription from 'getsentry/hooks/useSubscription';
import {parseOnDemandBudgetsFromSubscription} from 'getsentry/views/onDemandBudgets/utils';
import SpendLimitSettings from 'getsentry/views/spendLimits/spendLimitSettings';

function SpendLimitsRoot() {
  const organization = useOrganization();
  const subscription = useSubscription();
  const navigate = useNavigate();
  const location = useLocation();

  if (!subscription) {
    navigate('/settings/:orgId/billing/overview/');
    return null;
  }

  if (
    subscription.planDetails.budgetTerm === 'pay-as-you-go' &&
    location.pathname.includes('/on-demand')
  ) {
    navigate('/settings/:orgId/billing/pay-as-you-go/');
    return null;
  }
  if (
    subscription.planDetails.budgetTerm === 'on-demand' &&
    location.pathname.includes('/pay-as-you-go')
  ) {
    navigate('/settings/:orgId/billing/on-demand/');
    return null;
  }

  const documentTitle = t(
    '%s Spend Limits',
    capitalize(subscription.planDetails.budgetTerm)
  );

  const reserved = Object.entries(subscription.categories).reduce(
    (acc, [category, categoryInfo]) => {
      acc[category as DataCategory] = categoryInfo.reserved ?? 0;
      return acc;
    },
    {} as Record<DataCategory, number>
  );

  return (
    <Container>
      <SentryDocumentTitle title={documentTitle} />
      <SpendLimitSettings
        isOpen
        organization={organization}
        activePlan={subscription.planDetails}
        onDemandBudgets={parseOnDemandBudgetsFromSubscription(subscription)}
        onUpdate={() => {}}
        currentReserved={reserved}
        // TODO: update
        additionalProducts={{
          seer: {
            reserved: 0,
            reservedType: 'budget',
          },
        }}
        header={<SettingsPageHeader title={documentTitle} />}
      />
    </Container>
  );
}

export default SpendLimitsRoot;
