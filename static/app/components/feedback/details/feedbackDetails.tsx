import {CSSProperties} from 'react';

import EmptyFeedback from 'sentry/components/feedback/details/feedbackEmptyDetails';
import FeedbackItemLoader from 'sentry/components/feedback/feedbackItem/feedbackItemLoader';
import type {FeedbackItemLoaderQueryParams} from 'sentry/utils/feedback/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';

interface Props {
  className?: string;
  style?: CSSProperties;
}

export default function FeedbackDetails(props: Props) {
  const location = useLocation<FeedbackItemLoaderQueryParams>();

  const feedbackSlug = decodeScalar(location.query.feedbackSlug);

  if (!feedbackSlug) {
    return <EmptyFeedback {...props} />;
  }

  const [projectSlug, feedbackId] = feedbackSlug.split(':');
  return (
    <FeedbackItemLoader {...props} projectSlug={projectSlug} feedbackId={feedbackId} />
  );
}
