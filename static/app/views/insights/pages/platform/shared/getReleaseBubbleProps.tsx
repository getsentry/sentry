import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import type {Organization, Release} from 'sentry/types';

type Params = Pick<LoadableChartWidgetProps, 'showReleaseAs'>;

export function useReleaseBubbleProps(params?: Params) {
  const organization = useOrganization();
  const pageFilters = usePageFilters();

  const {releases: releasesWithDate} = useReleaseStats(pageFilters.selection);
  const releases =
    releasesWithDate?.map(({date, version}) => ({
      timestamp: date,
      version,
    })) ?? [];

  return releases?.length
    ? ({releases, showReleaseAs: params?.showReleaseAs ?? 'bubble'} as const)
    : {};
}

export function getReleaseBubbleProps(
  organization: Organization,
  releases: Release[]
): {releases: Release[]; showReleaseAs: 'bubble'} | {} {
  return releases?.length
    ? {
        releases,
        showReleaseAs: 'bubble' as const,
      }
    : {};
}
