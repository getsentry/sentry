import {useEffect} from 'react';

import Section from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import Placeholder from 'sentry/components/placeholder';
import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {TraceDataSection as IssuesTraceDataSection} from 'sentry/views/issueDetails/traceDataSection';
import {
  type TimelineEvent,
  useTraceTimelineEvents,
} from 'sentry/views/issueDetails/traceTimeline/useTraceTimelineEvents';

/**
 * Doesn't require a Section wrapper. Rendered conditionally if
 * 1. there are 2 or more same-trace issues (timeline).
 * 2. there is 1 same-trace issue, different from crashReportId (issue link).
 */
export default function TraceDataSection({
  eventData,
  crashReportId,
}: {
  crashReportId: string | undefined;
  eventData: Event;
}) {
  // If there's a linked error from a crash report and only one other issue, showing both could be redundant.
  // TODO: we could add a jest test .spec for this ^
  const organization = useOrganization();
  const {oneOtherIssueEvent, traceEvents, isLoading, isError} = useTraceTimelineEvents({
    event: eventData,
  });
  // Note traceEvents includes the current event (feedback).

  useEffect(() => {
    if (isError) {
      trackAnalytics('feedback.trace-section.error', {organization});
    } else if (!isLoading) {
      if (traceEvents.length > 1) {
        trackAnalytics('feedback.trace-section.loaded', {
          numEvents: traceEvents.length - 1,
          organization,
        });
      }
      if (eventIsCrashReportDup(oneOtherIssueEvent, crashReportId)) {
        trackAnalytics('feedback.trace-section.crash-report-dup', {organization});
      }
    }
  }, [
    crashReportId,
    isError,
    isLoading,
    oneOtherIssueEvent,
    organization,
    traceEvents.length,
  ]);

  return organization.features.includes('user-feedback-trace-section') &&
    !isError &&
    traceEvents.length > 1 &&
    !eventIsCrashReportDup(oneOtherIssueEvent, crashReportId) ? (
    <Section icon={<IconSpan size="xs" />} title={t('Data From The Same Trace')}>
      {isLoading ? (
        <Placeholder height="114px" />
      ) : (
        <IssuesTraceDataSection event={eventData} />
      )}
    </Section>
  ) : null;
}

function eventIsCrashReportDup(
  event: TimelineEvent | undefined,
  crashReportId: string | undefined
) {
  return !!crashReportId && event?.id === crashReportId;
}
