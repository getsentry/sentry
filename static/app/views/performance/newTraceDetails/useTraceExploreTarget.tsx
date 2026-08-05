import {useMemo} from 'react';

import type {LinkProps} from '@sentry/scraps/link';

import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import type {EventView} from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import {
  getSearchInExploreTarget,
  TraceDrawerActionKind,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';
import type {TraceWaterfallSource} from 'sentry/views/performance/newTraceDetails/traceWaterfall';

interface UseTraceExploreTargetProps {
  source: TraceWaterfallSource;
  traceEventView: EventView;
  traceSlug: string;
  replayId?: string;
}

interface TraceExploreTarget {
  onClick: () => void;
  to: LinkProps['to'];
}

/**
 * The Explore destination for the current trace, or null when Explore is
 * unavailable. `onClick` records the same analytics event for every entry point.
 */
export function useTraceExploreTarget({
  traceSlug,
  traceEventView,
  source,
  replayId,
}: UseTraceExploreTargetProps): TraceExploreTarget | null {
  const organization = useOrganization();
  const location = useLocation();

  return useMemo(() => {
    if (!organization.features.includes('visibility-explore-view') || !traceSlug) {
      return null;
    }

    const {start, end, statsPeriod} = traceEventView;

    // When viewing from replay page, link to explore with replayId query and trace groupBy
    if (source === 'replay' && replayId) {
      const search = new MutableSearch('');
      search.addFilterValue('replayId', replayId);

      return {
        to: getExploreUrl({
          organization,
          selection: {
            datetime: {
              start: start ?? null,
              end: end ?? null,
              period: start && end ? null : (statsPeriod ?? null),
              utc: null,
            },
            projects: [],
            environments: [],
          },
          query: search.formatString(),
          groupBy: ['trace'],
          mode: Mode.AGGREGATE,
        }),
        onClick: () =>
          traceAnalytics.trackExploreSearch(
            organization,
            'replayId',
            replayId,
            TraceDrawerActionKind.INCLUDE,
            'toolbar_menu'
          ),
      };
    }

    const target = getSearchInExploreTarget(
      organization,
      {
        ...location,
        query: {
          start,
          end,
          statsPeriod: start && end ? null : statsPeriod, // We don't want statsPeriod to have precedence over start and end
        },
      },
      '-1',
      'trace',
      traceSlug,
      TraceDrawerActionKind.INCLUDE
    );

    return {
      to: {pathname: target.pathname, query: target.query},
      onClick: () =>
        traceAnalytics.trackExploreSearch(
          organization,
          'trace',
          traceSlug,
          TraceDrawerActionKind.INCLUDE,
          'toolbar_menu'
        ),
    };
  }, [organization, location, traceSlug, traceEventView, source, replayId]);
}
