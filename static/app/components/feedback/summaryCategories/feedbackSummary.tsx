import styled from '@emotion/styled';

import useFeedbackSummary from 'sentry/components/feedback/list/useFeedbackSummary';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';

export default function FeedbackSummary() {
  const {isError, isPending, summary, tooFewFeedbacks} = useFeedbackSummary();

  if (isPending) {
    return <LoadingPlaceholder />;
  }

  if (isError) {
    return <SummaryContent>{t('Error summarizing feedback.')}</SummaryContent>;
  }

  if (tooFewFeedbacks) {
    return (
      <SummaryContent>{t('Not enough feedback to generate AI summary')}</SummaryContent>
    );
  }

  return <SummaryContent>{summary}</SummaryContent>;
}

const LoadingPlaceholder = styled(Placeholder)`
  height: 48px;
  width: 100%;
  border-radius: ${p => p.theme.borderRadius};
`;

const SummaryContent = styled('p')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  margin: 0;
`;
