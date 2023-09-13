import {FeedbackItemResponse, HydratedFeedbackItem} from 'sentry/utils/feedback/types';

export default function hydrateFeedbackRecord(
  data: FeedbackItemResponse
): HydratedFeedbackItem {
  return {
    ...data,
    timestamp: new Date(data.timestamp),
  };
}
