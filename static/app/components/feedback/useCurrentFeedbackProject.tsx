import decodeFeedbackSlug from 'sentry/components/feedback/decodeFeedbackSlug';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

// See also: useCurrentFeedbackId()

export default function useCurrentFeedbackProject() {
  const {feedbackSlug: projectSlug} = useLocationQuery({
    fields: {feedbackSlug: val => decodeFeedbackSlug(val).projectSlug ?? ''},
  });

  return projectSlug;
}
