import {Fragment} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {IssueCategory} from 'sentry/types/group';
import useRouteAnalyticsParams from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import useOrganization from 'sentry/utils/useOrganization';

import {TraceIssueEvent} from './traceTimeline/traceIssue';
import {TraceLink} from './traceTimeline/traceLink';
import {TraceTimeline} from './traceTimeline/traceTimeline';
import {useTraceTimelineEvents} from './traceTimeline/useTraceTimelineEvents';

export function TraceDataSection({event, group}: {event: Event; group: Group}) {
  const organization = useOrganization();
  // This is also called within the TraceTimeline component but caching will save a second call
  const {isLoading, oneOtherIssueEvent} = useTraceTimelineEvents({
    event,
  });

  const hasProfilingFeature = organization.features.includes('profiling');
  const hasIssueDetailsTrace = organization.features.includes(
    'issue-details-always-show-trace'
  );
  const hasTracePreviewFeature =
    hasProfilingFeature &&
    hasIssueDetailsTrace &&
    // Only display this for error or default events since performance events are handled elsewhere
    group.issueCategory !== IssueCategory.PERFORMANCE;

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
        {/* If the user has trace preview, they are seeing the link to the full trace there already and we wont duplicate it */}
        {!hasTracePreviewFeature && <TraceLink event={event} />}
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
