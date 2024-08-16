import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export function useHasNewTimelineUI() {
  const location = useLocation();
  const organization = useOrganization();

  if (location.query.newTimeline === '0') {
    return false;
  }
  return (
    location.query.newTimeline === '1' ||
    organization.features.includes('new-timeline-ui')
  );
}
