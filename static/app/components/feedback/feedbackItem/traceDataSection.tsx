import {useEffect} from 'react';

import Section from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import {IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';
import {TraceDataSection as IssuesTraceDataSection} from 'sentry/views/issueDetails/traceDataSection';
import {useTraceTimelineEvents} from 'sentry/views/issueDetails/traceTimeline/useTraceTimelineEvents';

/**
 * Doesn't require a Section wrapper. Rendered conditionally if
 * 1. there are 2 or more same-trace issues (timeline).
 * 2. there is 1 same-trace issue, different from crashReportId (issue link).
 */
export default function TraceDataSection({
  eventData,
  crashReportId,
  hasProject,
}: {
  crashReportId: string | undefined;
  eventData: Event;
  hasProject: boolean;
}) {
  // If there's a linked error from a crash report and only one other issue, showing both could be redundant.
  // TODO: we could add a jest test .spec for this ^
  const organization = useOrganization();
  const {oneOtherIssueEvent, traceEvents, isLoading, isError} = useTraceTimelineEvents({
    event: eventData,
  });
  const show =
    !isLoading &&
    !isError &&
    traceEvents.length > 1 && // traceEvents include the current event.
    (!hasProject || !crashReportId || oneOtherIssueEvent?.id === crashReportId);

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
      if (hasProject && !!crashReportId && oneOtherIssueEvent?.id === crashReportId) {
        trackAnalytics('feedback.trace-section.crash-report-dup', {organization});
      }
    }
  }, [
    crashReportId,
    hasProject,
    isError,
    isLoading,
    oneOtherIssueEvent?.id,
    organization,
    traceEvents.length,
  ]);

  return show && organization.features.includes('user-feedback-trace-section') ? (
    <Section icon={<IconSpan size="xs" />} title={t('Data From The Same Trace')}>
      <IssuesTraceDataSection event={eventData} />
    </Section>
  ) : null;
}
