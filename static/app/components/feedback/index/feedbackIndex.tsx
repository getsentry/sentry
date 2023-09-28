import {CSSProperties} from 'react';
import styled from '@emotion/styled';

import FeedbackIndexLoader from 'sentry/components/feedback/index/feedbackIndexLoader';
import useFeedbackListQueryParams from 'sentry/components/feedback/useFeedbackListQueryParams';
import {useLocation} from 'sentry/utils/useLocation';
import FluidHeight from 'sentry/views/replays/detail/layout/fluidHeight';

interface Props {
  className?: string;
  style?: CSSProperties;
}

export default function FeedbackIndex(props: Props) {
  const location = useLocation();
  const query = useFeedbackListQueryParams({
    location,
    queryReferrer: 'feedback_list_page',
  });

  return (
    <Container {...props}>
      <FeedbackIndexLoader query={query} />
    </Container>
  );
}

const Container = styled(FluidHeight)`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;
