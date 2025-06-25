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

  if (!organization.features.includes('user-feedback-ai-summaries')) {
    return null;
  }

  return (
    <SummaryIconContainer>
      <IconSeer size="xs" />
      <SummaryContainer>
        <SummaryHeader>{t('Feedback Summary')}</SummaryHeader>
        {isPending ? (
          <LoadingContainer>
            <StyledLoadingIndicator size={24} />
            <SummaryContent>{t('Summarizing feedback received...')}</SummaryContent>
          </LoadingContainer>
        ) : tooFewFeedbacks ? (
          <SummaryContent>
            {t('Bummer... Not enough feedback to summarize (yet).')}
          </SummaryContent>
        ) : isError ? (
          <SummaryContent>{t('Error summarizing feedback.')}</SummaryContent>
        ) : (
          <SummaryContent>{summary}</SummaryContent>
        )}
      </SummaryContainer>
    </SummaryIconContainer>
  );
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: ${space(0.5)} 0 0 0;
`;

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
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeightBold};
  margin: 0;
`;

const SummaryContent = styled('p')`
  font-size: ${p => p.theme.fontSize.sm};
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
