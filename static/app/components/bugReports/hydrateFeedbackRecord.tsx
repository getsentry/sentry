import {FeedbackItemResponse, HydratedFeedbackItem} from 'sentry/utils/feedback/types';

export default function hydrateFeedbackRecord(
  data: FeedbackItemResponse
): HydratedFeedbackItem {
  return {
    ...data,
    feedback_id: data.feedback_id.replaceAll('-', ''),
    timestamp: new Date(data.timestamp),
  };
}
