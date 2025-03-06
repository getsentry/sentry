import decodeFeedbackSlug from 'sentry/components/feedback/decodeFeedbackSlug';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

// See also: useCurrentFeedbackProject()

export default function useCurrentFeedbackId() {
  const {feedbackSlug: feedbackId} = useLocationQuery({
    fields: {feedbackSlug: (val: any) => decodeFeedbackSlug(val).feedbackId ?? ''},
  });

  return feedbackId;
}
