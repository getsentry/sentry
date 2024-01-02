import decodeFeedbackSlug from 'sentry/components/feedback/decodeFeedbackSlug';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

export default function useCurrentFeedbackId() {
  const {feedbackSlug} = useLocationQuery({
    fields: {
      feedbackSlug: val => decodeFeedbackSlug(val).feedbackId ?? '',
    },
  });
  return feedbackSlug;
}
