import styled from '@emotion/styled';

import useFeedbackSummary from 'sentry/components/feedback/list/useFeedbackSummary';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconSeer} from 'sentry/icons/iconSeer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

export default function FeedbackSummary() {
  const {isError, isPending, summary, tooFewFeedbacks} = useFeedbackSummary();

  const organization = useOrganization();

  if (!organization.features.includes('user-feedback-ai-summaries') || isError) {
    return null;
  }

  return (
    <SummaryIconContainer>
      <IconSeer size="xs" />
      <SummaryContainer>
        <SummaryHeader>{t('Feedback Summary')}</SummaryHeader>
        {isPending ? (
          <LoadingContainer>
            <LoadingIndicator style={{margin: 0, marginTop: space(0.5)}} size={24} />
            <SummaryContent>Summarizing feedback received...</SummaryContent>
          </LoadingContainer>
        ) : tooFewFeedbacks ? (
          <SummaryContent>
            {t('Bummer... Not enough feedback to summarize (yet).')}
          </SummaryContent>
        ) : (
          <SummaryContent>{summary}</SummaryContent>
        )}
      </SummaryContainer>
    </SummaryIconContainer>
  );
}

const LoadingContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  align-items: center;
`;

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

const SummaryIconContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  align-items: baseline;
`;
