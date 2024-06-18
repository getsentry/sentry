import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

export function useHasNewTimelineUI() {
  const location = useLocation();
  const organization = useOrganization();
  return (
    location.query.newTimeline === '1' ||
    organization.features.includes('new-timeline-ui')
  );
}
