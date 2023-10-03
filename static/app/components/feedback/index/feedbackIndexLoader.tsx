import {CSSProperties} from 'react';

import FeedbackErrorDetails from 'sentry/components/feedback/details/feedbackErrorDetails';
import FeedbackList from 'sentry/components/feedback/list/feedbackList';
import FeedbackListWrapper from 'sentry/components/feedback/list/feedbackListWrapper';
import useFetchFeedbackList from 'sentry/components/feedback/useFetchFeedbackList';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';

interface Props {
  query: Record<string, string | string[] | undefined>;
  className?: string;
  style?: CSSProperties;
}

export default function FeedbackIndexLoader(props: Props) {
  const {
    isLoading,
    isError,
    data,
    pageLinks: _,
  } = useFetchFeedbackList({query: props.query}, {});

  return isLoading || !data ? (
    <FeedbackListWrapper>
      <Placeholder height="100%" />
    </FeedbackListWrapper>
  ) : isError ? (
    <FeedbackListWrapper>
      <FeedbackErrorDetails error={t('Unable to load feedback list')} />
    </FeedbackListWrapper>
  ) : (
    <FeedbackListWrapper>
      <FeedbackList items={data} />
    </FeedbackListWrapper>
  );
}
