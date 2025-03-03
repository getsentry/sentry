import type {PromotionData} from 'getsentry/types';

/**
 * Returns a promotion if there is one that is either completed or active
 * which means that a discount is applicable to the subscription
 */
export function getCompletedOrActivePromotion(promotionData?: PromotionData) {
  // only ever one completed or active promo
  return promotionData?.completedPromotions?.[0] ?? promotionData?.activePromotions?.[0];
}
