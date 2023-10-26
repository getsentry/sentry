import {
  HydratedFeedbackItem,
  RawFeedbackItemResponse,
} from 'sentry/utils/feedback/item/types';

export default function hydrateFeedbackRecord(
  apiResponse: RawFeedbackItemResponse
): HydratedFeedbackItem {
  return {
    ...apiResponse,
    replay_id: undefined,
    timestamp: new Date(apiResponse.firstSeen ?? ''),
    feedback_id: apiResponse.id,
  };
}
