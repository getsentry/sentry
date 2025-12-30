import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {ExternalLink, Link} from 'sentry/components/core/link';
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
  if (!filterSet?.length) {
    return null;
  }
  const filterFeedback = filterSet.find(f => f.value === '6'); // category: feedback
  return filterFeedback ? (
    <StyledFeedbackAlert variant="info">
      {tct(
        'This issue category condition is ONLY for feedback from the [linkWidget:built-in widget]. [linkModal: Crash-report modal] alerts can be enabled in [link:Project Settings].',
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
