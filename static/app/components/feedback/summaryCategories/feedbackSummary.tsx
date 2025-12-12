import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import useFeedbackSummary from 'sentry/components/feedback/list/useFeedbackSummary';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

export default function FeedbackSummary() {
  const {isError, isPending, summary, tooFewFeedbacks} = useFeedbackSummary();

  // if we are showing this component, gen-ai-features must be true
  // and org.hideAiFeatures must be false,
  // but we still need to check that their seer acknowledgement exists
  const {setupAcknowledgement, isPending: isOrgSeerSetupPending} =
    useOrganizationSeerSetup();
  const organization = useOrganization();

  useEffect(() => {
    // Analytics for the rendered state. Should match the conditions below.
    if (isPending || isOrgSeerSetupPending) {
      return;
    }
    if (!setupAcknowledgement.orgHasAcknowledged) {
      trackAnalytics('feedback.summary.seer-cta-rendered', {
        organization,
      });
    } else if (isError) {
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
  }, [
    organization,
    isError,
    tooFewFeedbacks,
    setupAcknowledgement.orgHasAcknowledged,
    isPending,
    isOrgSeerSetupPending,
  ]);

  if (isPending || isOrgSeerSetupPending) {
    return <LoadingPlaceholder />;
  }

  if (!setupAcknowledgement.orgHasAcknowledged) {
    return (
      <SummaryContent>
        {tct(
          'Seer access is required to see feedback summaries. Please view the [link:Seer settings page] for more information.',
          {link: <Link to={`/settings/${organization.slug}/seer/`} />}
        )}
      </SummaryContent>
    );
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
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  margin: 0;
`;
