import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';

export function useReleaseBubbleProps() {
  const organization = useOrganization();
  const pageFilters = usePageFilters();

  const {releases: releasesWithDate} = useReleaseStats(pageFilters.selection);
  const releases =
    releasesWithDate?.map(({date, version}) => ({
      timestamp: date,
      version,
    })) ?? [];

  return organization.features.includes('release-bubbles-ui')
    ? ({releases, showReleaseAs: 'bubble'} as const)
    : {};
}
