import {Client} from 'sentry/api';
import type {Organization} from 'sentry/types/organization';
import {QueryClient} from 'sentry/utils/queryClient';

import type {PromotionClaimed, PromotionData} from 'getsentry/types';
import {createPromotionCheckQueryKey} from 'getsentry/utils/usePromotionTriggerCheck';

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
