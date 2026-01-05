import * as Sentry from '@sentry/react';

import {promptsUpdate} from 'sentry/actionCreators/prompts';
import {Client} from 'sentry/api';
import type {Organization} from 'sentry/types/organization';
import {QueryClient, type QueryObserverResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';

import {
  openPromotionModal,
  openPromotionReminderModal,
} from 'getsentry/actionCreators/modal';
import type {
  Promotion,
  PromotionClaimed,
  PromotionData,
  Subscription,
} from 'getsentry/types';
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

export async function checkForPromptBasedPromotion({
  organization,
  onRefetch,
  promptFeature,
  subscription,
  promotionData,
  onAcceptConditions,
}: {
  onAcceptConditions: () => void;
  onRefetch: () => Promise<QueryObserverResult<PromotionData | any, RequestError>>;
  organization: Organization;
  promotionData: PromotionData;
  promptFeature: string;
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
    await onRefetch(); // will refresh promotionData
    // find the matching available promotion based on prompt features
    const promotion = promotionData?.availablePromotions?.find(
      (promo: Promotion) => promo.promptActivityTrigger === promptFeature
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
