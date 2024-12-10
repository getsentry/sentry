import {Fragment} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';

import {TraceIssueEvent} from './traceTimeline/traceIssue';
import {TraceLink} from './traceTimeline/traceLink';
import {TraceTimeline} from './traceTimeline/traceTimeline';
import {useTraceTimelineEvents} from './traceTimeline/useTraceTimelineEvents';

export function TraceDataSection({event}: {event: Event}) {
  // This is also called within the TraceTimeline component but caching will save a second call
  const {isLoading, oneOtherIssueEvent} = useTraceTimelineEvents({
    event,
  });
  let params: Record<string, boolean> = {};
  if (!isLoading && oneOtherIssueEvent !== undefined) {
    params = {
      has_related_trace_issue: true,
    };
  }
  useRouteAnalyticsParams(params);

  if (isLoading) {
    return null;
  }

  return (
    <Fragment>
      <StyledTraceLink>
        {/* Used for trace-related issue */}
        {oneOtherIssueEvent && (
          <span>{t('One other issue appears in the same trace.')}</span>
        )}
        <TraceLink event={event} />
      </StyledTraceLink>
      {oneOtherIssueEvent === undefined ? (
        <TraceTimeline event={event} />
      ) : (
        <TraceIssueEvent event={oneOtherIssueEvent} />
      )}
    </Fragment>
  );
}

const StyledTraceLink = styled('div')`
  display: flex;
  white-space: nowrap;
  overflow: hidden;
  gap: ${space(0.25)};
`;
