import {CSSProperties} from 'react';
import styled from '@emotion/styled';

import EmptyFeedback from 'sentry/components/feedback/details/feedbackEmptyDetails';
import FeedbackItemLoader from 'sentry/components/feedback/feedbackItem/feedbackItemLoader';
import type {FeedbackItemLoaderQueryParams} from 'sentry/utils/feedback/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props {
  className?: string;
  style?: CSSProperties;
}

export default function FeedbackDetails(props: Props) {
  const location = useLocation<FeedbackItemLoaderQueryParams>();

  const feedbackSlug = decodeScalar(location.query.feedbackSlug);

  if (!feedbackSlug) {
    return (
      <Container {...props}>
        <EmptyFeedback />
      </Container>
    );
  }

  const [projectSlug, feedbackId] = feedbackSlug.split(':');
  return (
    <Container {...props}>
      <FeedbackItemLoader projectSlug={projectSlug} feedbackId={feedbackId} />
    </Container>
  );
}

const Container = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;
