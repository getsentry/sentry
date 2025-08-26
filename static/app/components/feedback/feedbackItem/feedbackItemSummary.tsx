import styled from '@emotion/styled';

import type {FeedbackIssue} from 'sentry/utils/feedback/types';

interface Props {
  feedbackIssue: FeedbackIssue;
  className?: string;
}

export default function FeedbackItemSummary({className, feedbackIssue}: Props) {
  const summary = feedbackIssue.metadata.summary;

  return summary ? (
    <SummaryContainer className={className}>{summary}</SummaryContainer>
  ) : null;
}

const SummaryContainer = styled('h3')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: 600;
  line-height: 1.4;
  color: ${p => p.theme.textColor};
  margin: 0;
`;
