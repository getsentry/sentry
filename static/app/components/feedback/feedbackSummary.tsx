import styled from '@emotion/styled';

import useFeedbackSummary from 'sentry/components/feedback/list/useFeedbackSummary';
import Placeholder from 'sentry/components/placeholder';
import {IconSeer} from 'sentry/icons/iconSeer';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';

export default function FeedbackSummary() {
  const {isError, isPending, summary, tooFewFeedbacks} = useFeedbackSummary();

  const organization = useOrganization();

  if (
    !organization.features.includes('user-feedback-ai-summaries') ||
    tooFewFeedbacks ||
    isError
  ) {
    return null;
  }

  if (isPending) {
    return <Placeholder height="100px" />;
  }

  return (
    <SummaryIconContainer>
      <IconSeer size="xs" />
      <SummaryContainer>
        <SummaryHeader>{t('Feedback Summary')}</SummaryHeader>
        <SummaryContent>{summary}</SummaryContent>
      </SummaryContainer>
    </SummaryIconContainer>
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

const SummaryIconContainer = styled('div')`
  display: flex;
  gap: ${space(1)};
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  align-items: baseline;
`;
