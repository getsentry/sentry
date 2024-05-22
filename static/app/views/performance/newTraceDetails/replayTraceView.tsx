import {useEffect, useLayoutEffect} from 'react';
import qs from 'qs';

import {useHasNewTagsUI} from 'sentry/components/events/eventTags/util';
import {trackAnalytics} from 'sentry/utils/analytics';
import {browserHistory} from 'sentry/utils/browserHistory';
import type EventView from 'sentry/utils/discover/eventView';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import useOrganization from 'sentry/utils/useOrganization';
import type {ReplayRecord} from 'sentry/views/replays/types';

import type {TraceMetaQueryResults} from './traceApi/useTraceMeta';
import {TraceViewContent} from '.';

type Props = {
  eventView: EventView;
  metaResults: TraceMetaQueryResults;
  replayRecord: undefined | ReplayRecord;
  status: 'error' | 'loading' | 'success';
  traces: TraceSplitResults<TraceFullDetailed>;
};

export function ReplayTraceView(props: Props) {
  const organization = useOrganization();
  const hasNewTagsUI = useHasNewTagsUI();

  useLayoutEffect(() => {
    if (hasNewTagsUI) {
      return;
    }

    // Enables the new trace tags/contexts ui for the trace view
    const queryString = qs.parse(window.location.search);
    queryString.traceView = '1';
    browserHistory.replace({
      pathname: window.location.pathname,
      query: queryString,
    });
  }, [hasNewTagsUI]);

  useEffect(() => {
    trackAnalytics('performance_views.replay_trace_view_v1_page_load', {
      organization,
    });
  }, [organization]);

  return (
    <TraceViewContent
      status={props.status}
      trace={props.traces}
      traceSlug={''}
      organization={organization}
      traceEventView={props.eventView}
      metaResults={props.metaResults}
      source="replay"
    />
  );
}
