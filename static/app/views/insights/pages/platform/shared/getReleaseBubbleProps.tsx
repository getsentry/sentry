import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';

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

  return organization.features.includes('release-bubbles-ui')
    ? ({releases, showReleaseAs: params?.showReleaseAs ?? 'bubble'} as const)
    : {};
}
