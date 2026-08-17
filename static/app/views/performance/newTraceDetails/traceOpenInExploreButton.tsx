import {LinkButton} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import type {EventView} from 'sentry/utils/discover/eventView';
import type {TraceWaterfallSource} from 'sentry/views/performance/newTraceDetails/traceWaterfall';
import {useTraceExploreTarget} from 'sentry/views/performance/newTraceDetails/useTraceExploreTarget';

type Props = {
  source: TraceWaterfallSource;
  traceEventView: EventView;
  traceSlug: string;
  replayId?: string;
};

export function TraceOpenInExploreButton({
  traceSlug,
  traceEventView,
  source,
  replayId,
}: Props) {
  const exploreTarget = useTraceExploreTarget({
    traceSlug,
    traceEventView,
    source,
    replayId,
  });

  if (!exploreTarget) {
    return null;
  }

  return (
    <LinkButton size="xs" to={exploreTarget.to} onClick={exploreTarget.onClick}>
      {t('Open in Explore')}
    </LinkButton>
  );
}
