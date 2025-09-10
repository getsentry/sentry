import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {useOrganizationSeerSetup} from 'sentry/components/events/autofix/useOrganizationSeerSetup';
import useFeedbackSummary from 'sentry/components/feedback/list/useFeedbackSummary';
import Placeholder from 'sentry/components/placeholder';
import {t, tct} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

export default function FeedbackSummary() {
  const {isError, isPending, summary, tooFewFeedbacks} = useFeedbackSummary();

  // if we are showing this component, gen-ai-features must be true
  // and org.hideAiFeatures must be false,
  // but we still need to check that their seer acknowledgement exists
  const {setupAcknowledgement, isPending: isOrgSeerSetupPending} =
    useOrganizationSeerSetup();
  const organization = useOrganization();

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
  border-radius: ${p => p.theme.borderRadius};
`;

const SummaryContent = styled('p')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  margin: 0;
`;
