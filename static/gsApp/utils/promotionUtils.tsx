import * as Sentry from '@sentry/react';
import type {QueryObserverResult} from '@tanstack/react-query';

import {promptsUpdate} from 'sentry/actionCreators/prompts';
import {Client} from 'sentry/api';
import type {Organization} from 'sentry/types/organization';
import {QueryClient} from 'sentry/utils/queryClient';

import {
  openPromotionModal,
  openPromotionReminderModal,
} from 'getsentry/actionCreators/modal';
import type {
  DiscountInfo,
  Plan,
  PromotionClaimed,
  PromotionData,
  Subscription,
} from 'getsentry/types';
import {isBizPlanFamily} from 'getsentry/utils/billing';
import {createPromotionCheckQueryKey} from 'getsentry/utils/usePromotionTriggerCheck';

import trackGetsentryAnalytics from './trackGetsentryAnalytics';

export async function claimAvailablePromotion({
  promotionData,
  organization,
  promptFeature,
}: {
  organization: Organization;
  promotionData: PromotionData;
  promptFeature?: string;
}) {
  const api = new Client();
  const queryClient = new QueryClient();
  let completedPromotions = promotionData.completedPromotions,
    activePromotions = promotionData.activePromotions,
    availablePromotions = promotionData.availablePromotions;

  if (!availablePromotions) {
    return;
  }

  if (promptFeature) {
    availablePromotions = availablePromotions.filter(
      promo => promo.promptActivityTrigger === promptFeature
    );
  } else {
    // only consider auto-opt-in promotions if no prompt feature is specified
    availablePromotions = availablePromotions.filter(promo => promo.autoOptIn);
  }

  if (availablePromotions.length === 0) {
    return;
  }

  const promo = availablePromotions[availablePromotions.length - 1]!;

  const claimedPromo: PromotionClaimed = await api.requestPromise(
    `/organizations/${organization.slug}/promotions/${promo.slug}/claim/`,
    {
      method: 'POST',
    }
  );

  // TODO: avoid mutating the state here
  availablePromotions.pop();
  // if immediately complete, then add to that array
  if (claimedPromo.dateCompleted) {
    completedPromotions = completedPromotions || [];
    completedPromotions.push(claimedPromo);
  } else {
    activePromotions = activePromotions || [];
    activePromotions.push(claimedPromo);
  }

  // note this does not work but but we avoid the problem by mutating the input state
  queryClient.setQueryData<PromotionData>(
    createPromotionCheckQueryKey(organization.slug),
    {
      availablePromotions,
      completedPromotions,
      activePromotions,
    }
  );
}

export function showSubscriptionDiscount({
  activePlan,
  discountInfo,
}: {
  activePlan: Plan;
  discountInfo?: DiscountInfo;
}): boolean {
  return !!(
    discountInfo?.durationText &&
    discountInfo.discountType === 'percentPoints' &&
    activePlan.billingInterval === discountInfo.billingInterval &&
    discountInfo.creditCategory === 'subscription'
  );
}

export function showChurnDiscount({
  activePlan,
  discountInfo,
}: {
  activePlan: Plan;
  discountInfo?: DiscountInfo;
}) {
  // for now, only show discouns for percentPoints that are for the same billing interval
  if (
    discountInfo?.discountType !== 'percentPoints' ||
    activePlan.billingInterval !== discountInfo?.billingInterval
  ) {
    return false;
  }
  switch (discountInfo.planRequirement) {
    case 'business':
      return isBizPlanFamily(activePlan);
    case 'paid':
      // can't select a free plan on the checkout page
      return true;
    default:
      return false;
  }
}

export async function checkForPromptBasedPromotion({
  organization,
  refetch,
  promptFeature,
  subscription,
  promotionData,
  onAcceptConditions,
}: {
  onAcceptConditions: () => void;
  organization: Organization;
  promotionData: PromotionData;
  promptFeature: string;
  refetch: () => Promise<QueryObserverResult<PromotionData, unknown>>;
  subscription: Subscription;
}) {
  // from the existing promotion data, check if the user has already claimed the prompt-based promotion
  const completedPromotion = promotionData.completedPromotions?.find(
    promoClaimed => promoClaimed.promotion.promptActivityTrigger === promptFeature
  );
  if (completedPromotion) {
    // add tracking to the modal
    openPromotionReminderModal(
      completedPromotion,
      () => {
        trackGetsentryAnalytics('growth.promo_reminder_modal_keep', {
          organization,
          promo: completedPromotion.promotion.slug,
        });
        onAcceptConditions();
      },
      () => {
        trackGetsentryAnalytics('growth.promo_reminder_modal_continue_downgrade', {
          organization,
          promo: completedPromotion.promotion.slug,
        });
      }
    );
    return;
  }
  // if no completed promo, trigger the prompt endpoint and see if one is available
  try {
    const api = new Client();
    await promptsUpdate(api, {
      organization,
      feature: promptFeature,
      status: 'dismissed',
    });
    const result = await refetch();
    // find the matching available promotion based on prompt features
    const promotion = result?.data?.availablePromotions?.find(
      promo => promo.promptActivityTrigger === promptFeature
    );
    if (!promotion) {
      return;
    }
    const intervalPrice = subscription.customPrice
      ? subscription.customPrice
      : subscription.planDetails.price || 0;

    openPromotionModal({
      promotion,
      organization,
      price: intervalPrice,
      promptFeature,
      onAccept: onAcceptConditions,
    });
  } catch (err) {
    Sentry.captureException(err);
    return;
  }
}
