import {useEffect} from 'react';
import styled from '@emotion/styled';

import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import useFeedbackSummary from 'sentry/components/feedback/list/useFeedbackSummary';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

export default function FeedbackSummary() {
  const {isError, isPending, summary, tooFewFeedbacks} = useFeedbackSummary();

  // if we are showing this component, gen-ai-features must be true
  // and org.hideAiFeatures must be false,
  // but we still need to check that their seer acknowledgement exists
  const {isPending: isOrgSeerSetupPending} = useOrganizationSeerSetup();
  const organization = useOrganization();

  useEffect(() => {
    // Analytics for the rendered state. Should match the conditions below.
    if (isPending || isOrgSeerSetupPending) {
      return;
    }
    if (isError) {
      trackAnalytics('feedback.summary.summary-error', {
        organization,
      });
    } else if (tooFewFeedbacks) {
      trackAnalytics('feedback.summary.summary-too-few-feedbacks', {
        organization,
      });
    } else {
      trackAnalytics('feedback.summary.summary-rendered', {
        organization,
      });
    }
  }, [organization, isError, tooFewFeedbacks, isPending, isOrgSeerSetupPending]);

  if (isPending || isOrgSeerSetupPending) {
    return <LoadingPlaceholder />;
  }

  if (isError) {
    return <SummaryContent>{t('Error summarizing feedback.')}</SummaryContent>;
  }

  if (tooFewFeedbacks) {
    return (
      <SummaryContent>{t('Not enough feedback to generate AI summary.')}</SummaryContent>
    );
  }

  return <SummaryContent>{summary}</SummaryContent>;
}

const LoadingPlaceholder = styled(Placeholder)`
  height: 48px;
  width: 100%;
  border-radius: ${p => p.theme.radius.md};
`;

const SummaryContent = styled('p')`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
  margin: 0;
`;
