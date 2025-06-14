import styled from '@emotion/styled';

import useFeedbackSummary from 'sentry/components/feedback/list/useFeedbackSummary';
import LoadingError from 'sentry/components/loadingError';
import Placeholder from 'sentry/components/placeholder';
import {IconSeer} from 'sentry/icons/iconSeer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

export default function FeedbackSummary() {
  const {error, loading, summary, tooFewFeedbacks} = useFeedbackSummary();

  if (error) {
    return <LoadingError message={t('There was an error loading the summary')} />;
  }

  if (loading) {
    return <Placeholder height="100px" />;
  }

  // Maybe this is bad; parent should probably conditionally render the component based on the summary
  // check feedbackListPage.tsx for a potential alternative
  if (tooFewFeedbacks) {
    return null;
  }

  return (
    <Summary>
      <SummaryIconContainer>
        <div>
          <IconSeer size="xs" />
        </div>
        <SummaryContainer>
          <SummaryHeader>{t('Feedback Summary')}</SummaryHeader>
          <SummaryContent>{summary}</SummaryContent>
        </SummaryContainer>
      </SummaryIconContainer>
    </Summary>
  );
}

const SummaryContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  width: 100%;
`;

const SummaryHeader = styled('p')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
`;

const SummaryContent = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
  margin: 0;
`;

const Summary = styled('div')`
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
`;

const SummaryIconContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
`;
