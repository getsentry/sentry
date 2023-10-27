import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';

export default function useFeedbackIdFromLocation() {
  const {feedbackSlug} = useLocationQuery({
    fields: {
      feedbackSlug: decodeScalar,
    },
  });
  const [, feedbackId] = feedbackSlug.split(':');
  return feedbackId;
}
