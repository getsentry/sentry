import {useState} from 'react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ResponseMeta} from 'sentry/api';
import {ExternalLink} from 'sentry/components/core/link';
import PanelHeader from 'sentry/components/panels/panelHeader';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';

import SubscriptionStore from 'getsentry/stores/subscriptionStore';
import {PlanTier, type Subscription} from 'getsentry/types/index';
import {displayBudgetName, isTrialPlan} from 'getsentry/utils/billing';
import OnDemandBudgets from 'getsentry/views/onDemandBudgets';
import {EditOnDemandButton} from 'getsentry/views/onDemandBudgets/editOnDemandButton';
import {hasOnDemandBudgetsFeature} from 'getsentry/views/onDemandBudgets/utils';
import OnDemandSummary from 'getsentry/views/subscriptionPage/onDemandSummary';

interface OnDemandSettingsProps {
  organization: Organization;
  subscription: Subscription;
}

export function OnDemandSettings({subscription, organization}: OnDemandSettingsProps) {
  const api = useApi();
  const [onDemandError, setOnDemandError] = useState<undefined | Error | string>(
    undefined
  );
  const displayOnDemandConfig =
    !subscription.isFree &&
    !isTrialPlan(subscription.plan) &&
    subscription.supportsOnDemand;

  if (!displayOnDemandConfig) {
    return null;
  }

  function saveOnDemand(onDemandMaxSpend: string | number) {
    api.request(`/customers/${subscription.slug}/`, {
      method: 'PUT',
      data: {onDemandMaxSpend},
      error: (err: ResponseMeta) => {
        setOnDemandError(
          err.responseJSON?.onDemandMaxSpend ||
            err.responseJSON?.detail ||
            t('There as an unknown error saving your changes.')
        );

        addErrorMessage(t('An error occurred.'));
      },
      success: data => {
        SubscriptionStore.set(data.slug, data);
        addSuccessMessage(
          t(
            '%s max spend updated',
            displayBudgetName(subscription.planDetails, {title: true})
          )
        );
      },
    });
  }

  const onDemandEnabled = subscription.planDetails.allowOnDemand;
  // VC partner accounts don't require a payment source (i.e. credit card) since they make all payments via VC
  const isVCPartner = subscription.partner?.partnership?.id === 'VC';
  const hasPaymentSource = !!subscription.paymentSource || isVCPartner;
  const hasOndemandBudgets =
    hasOnDemandBudgetsFeature(organization, subscription) &&
    Boolean(subscription.onDemandBudgets);

  return (
    <Container background="primary" border="primary" radius="md">
      <PanelHeader
        // Displays the edit button when user has budgets enabled
        hasButtons={
          (hasOnDemandBudgetsFeature(organization, subscription) &&
            !!subscription.paymentSource) ||
          subscription.planTier === PlanTier.AM3
        }
      >
        <PanelTitleWrapper>
          {displayBudgetName(subscription.planDetails, {
            title: true,
            withBudget: true,
            pluralOndemand: true,
          })}{' '}
          <QuestionTooltip
            size="sm"
            title={tct(
              `[budgetType] allows you to pay for additional data beyond your subscription's
									reserved quotas. [budgetType] is billed monthly at the end of each usage period. [link:Learn more]`,
              {
                budgetType: displayBudgetName(subscription.planDetails, {title: true}),
                link: (
                  <ExternalLink
                    href={
                      subscription.planTier === PlanTier.AM3
                        ? `https://docs.sentry.io/pricing/#pricing-how-it-works`
                        : `https://docs.sentry.io/pricing/legacy-pricing/#on-demand-volume`
                    }
                  />
                ),
              }
            )}
            isHoverable
          />
        </PanelTitleWrapper>
        {subscription.onDemandBudgets?.enabled && (
          <EditOnDemandButton organization={organization} subscription={subscription} />
        )}
      </PanelHeader>
      {/* AM3 doesn't have on-demand-budgets, but we want them to see the newer ui  */}
      {hasOndemandBudgets || subscription.planTier === PlanTier.AM3 ? (
        <OnDemandBudgets
          onDemandEnabled={onDemandEnabled}
          organization={organization}
          hasPaymentSource={hasPaymentSource}
          subscription={subscription}
        />
      ) : (
        <OnDemandSummary
          enabled={onDemandEnabled}
          error={onDemandError}
          value={subscription.onDemandMaxSpend}
          pricePerEvent={subscription.planDetails.onDemandEventPrice}
          hasPaymentSource={hasPaymentSource}
          onSave={value => saveOnDemand(value)}
          subscription={subscription}
          withPanel={false}
          withHeader={false}
          showSave
        />
      )}
    </Container>
  );
}

const PanelTitleWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
