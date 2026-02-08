import {LinkButton} from '@sentry/scraps/button';

import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {t} from 'sentry/locale';
import type EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import {
  getSearchInExploreTarget,
  TraceDrawerActionKind,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';

type Props = {
  source: string;
  traceEventView: EventView;
  trace_id: string;
  replayId?: string;
};

export function TraceOpenInExploreButton({
  trace_id,
  traceEventView,
  source,
  replayId,
}: Props) {
  const organization = useOrganization();
  const hasExploreEnabled = organization.features.includes('visibility-explore-view');
  const location = useLocation();

  if (!hasExploreEnabled || !trace_id) {
    return null;
  }

  const {start, end, statsPeriod} = traceEventView;

  // When viewing from replay page, link to explore with replayId query and trace groupBy
  if (source === 'replay' && replayId) {
    const search = new MutableSearch('');
    search.addFilterValue('replayId', replayId);
    const target = getExploreUrl({
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
    });

    return (
      <LinkButton
        size="xs"
        to={target}
        onClick={() => {
          traceAnalytics.trackExploreSearch(
            organization,
            'replayId',
            replayId,
            TraceDrawerActionKind.INCLUDE,
            'toolbar_menu'
          );
        }}
      >
        {t('Open in Explore')}
      </LinkButton>
    );
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
    trace_id ?? '',
    TraceDrawerActionKind.INCLUDE
  );

  return (
    <LinkButton
      size="xs"
      to={{pathname: target.pathname, query: target.query}}
      onClick={() => {
        traceAnalytics.trackExploreSearch(
          organization,
          'trace',
          trace_id ?? '',
          TraceDrawerActionKind.INCLUDE,
          'toolbar_menu'
        );
      }}
    >
      {t('Open in Explore')}
    </LinkButton>
  );
}
