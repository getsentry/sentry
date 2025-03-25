import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

export function useIssueDetailsTourAvailable() {
  const location = useLocation();
  const organization = useOrganization();
  const hasStreamlinedUI = useHasStreamlinedUI();

  if (!hasStreamlinedUI) {
    return false;
  }

  return (
    location.hash === '#tour' ||
    organization.features.includes('issue-details-streamline-tour')
  );
}
