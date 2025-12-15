import {LinkButton} from '@sentry/scraps/button/linkButton';

import {t} from 'sentry/locale';
import type EventView from 'sentry/utils/discover/eventView';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import {
  getSearchInExploreTarget,
  TraceDrawerActionKind,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/utils';

type Props = {
  traceEventView: EventView;
  trace_id: string;
};

export function TraceOpenInExploreButton({trace_id, traceEventView}: Props) {
  const organization = useOrganization();
  const hasExploreEnabled = organization.features.includes('visibility-explore-view');
  const location = useLocation();

  if (!hasExploreEnabled || !trace_id) {
    return null;
  }

  const {start, end, statsPeriod} = traceEventView;
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
