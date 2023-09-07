import {
  FeedbackRecordResponse,
  HydratedFeedbackRecord,
} from 'sentry/utils/feedback/types';

export default function hydrateFeedbackRecord(
  data: FeedbackRecordResponse
): HydratedFeedbackRecord {
  return {
    ...data,
    timestamp: new Date(data.timestamp),
  };
}
