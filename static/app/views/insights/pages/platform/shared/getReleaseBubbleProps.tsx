import usePageFilters from 'sentry/utils/usePageFilters';
import {useReleaseStats} from 'sentry/utils/useReleaseStats';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';

type Params = Pick<LoadableChartWidgetProps, 'showReleaseAs'>;

export function useReleaseBubbleProps(params?: Params) {
  const pageFilters = usePageFilters();

  const {releases: releasesWithDate} = useReleaseStats(pageFilters.selection);
  const releases =
    releasesWithDate?.map(({date, version}) => ({
      timestamp: date,
      version,
    })) ?? [];

  return {releases, showReleaseAs: params?.showReleaseAs ?? 'bubble'} as const;
}
