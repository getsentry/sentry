import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import {tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {IssueAlertFilterType, type IssueAlertRuleCondition} from 'sentry/types/alerts';
import useOrganization from 'sentry/utils/useOrganization';

export default function FeedbackAlertBanner({
  filters,
  projectSlug,
}: {
  filters: IssueAlertRuleCondition[] | undefined;
  projectSlug: string;
}) {
  const organization = useOrganization();
  const filterSet = filters?.filter(r => r.id === IssueAlertFilterType.ISSUE_CATEGORY);
  if (!filterSet || !filterSet.length) {
    return null;
  }
  const filterFeedback = filterSet.find(f => f.value === '6'); // category: feedback
  return filterFeedback ? (
    <StyledFeedbackAlert showIcon type="info">
      {tct(
        'This issue category condition is ONLY for feedbacks from the [linkWidget:built-in widget]. [linkModal: Crash-report modal] alerts can be enabled in [link:Project Settings].',
        {
          link: (
            <Link
              to={`/settings/${organization.slug}/projects/${projectSlug}/user-feedback/`}
            />
          ),
          linkWidget: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/user-feedback/#user-feedback-widget" />
          ),
          linkModal: (
            <ExternalLink href="https://docs.sentry.io/platforms/javascript/user-feedback/#crash-report-modal" />
          ),
        }
      )}
    </StyledFeedbackAlert>
  ) : null;
}

const StyledFeedbackAlert = styled(Alert)`
  margin: ${space(1)} 0 0 0;
`;
