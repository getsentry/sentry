import {Fragment, useEffect, useRef} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import ErrorBoundary from 'sentry/components/errorBoundary';
import CrashReportSection from 'sentry/components/feedback/feedbackItem/crashReportSection';
import FeedbackActivitySection from 'sentry/components/feedback/feedbackItem/feedbackActivitySection';
import FeedbackItemHeader from 'sentry/components/feedback/feedbackItem/feedbackItemHeader';
import Section from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import FeedbackReplay from 'sentry/components/feedback/feedbackItem/feedbackReplay';
import MessageSection from 'sentry/components/feedback/feedbackItem/messageSection';
import TagsSection from 'sentry/components/feedback/feedbackItem/tagsSection';
import PanelItem from 'sentry/components/panels/panelItem';
import QuestionTooltip from 'sentry/components/questionTooltip';
import TextCopyInput from 'sentry/components/textCopyInput';
import {IconChat, IconFire, IconLink, IconTag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import useOrganization from 'sentry/utils/useOrganization';
import {TraceDataSection as IssueDetailsTraceDataSection} from 'sentry/views/issueDetails/traceDataSection';
import {useTraceTimelineEvents} from 'sentry/views/issueDetails/traceTimeline/useTraceTimelineEvents';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
  tags: Record<string, string>;
}

export default function FeedbackItem({feedbackItem, eventData, tags}: Props) {
  const organization = useOrganization();
  const url =
    eventData?.contexts?.feedback?.url ??
    eventData?.tags?.find(tag => tag.key === 'url')?.value;
  const crashReportId = eventData?.contexts?.feedback?.associated_event_id;
  const theme = useTheme();

  const overflowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setTimeout(() => {
      overflowRef.current?.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }, 100);
  }, [feedbackItem.id, overflowRef]);

  const URL_NOT_FOUND = t('URL not found');
  const displayUrl =
    eventData?.contexts?.feedback || eventData?.tags ? url ?? URL_NOT_FOUND : '';
  const urlIsLink = displayUrl.length && displayUrl !== URL_NOT_FOUND;

  return (
    <Fragment>
      <FeedbackItemHeader eventData={eventData} feedbackItem={feedbackItem} />
      <OverflowPanelItem ref={overflowRef}>
        <Section>
          <MessageSection eventData={eventData} feedbackItem={feedbackItem} />
        </Section>

        {eventData ? (
          <TraceDataSection
            eventData={eventData}
            crashReportId={crashReportId}
            hasProject={!!feedbackItem.project}
          />
        ) : null}

        {!crashReportId || (crashReportId && url) ? (
          <Section icon={<IconLink size="xs" />} title={t('URL')}>
            <TextCopyInput
              style={urlIsLink ? {color: theme.blue400} : undefined}
              onClick={
                urlIsLink
                  ? e => {
                      e.preventDefault();
                      openNavigateToExternalLinkModal({linkText: displayUrl});
                    }
                  : () => {}
              }
            >
              {displayUrl}
            </TextCopyInput>
          </Section>
        ) : null}

        {crashReportId && feedbackItem.project ? (
          <Section icon={<IconFire size="xs" />} title={t('Linked Error')}>
            <ErrorBoundary mini>
              <CrashReportSection
                organization={organization}
                crashReportId={crashReportId}
                projectSlug={feedbackItem.project.slug}
              />
            </ErrorBoundary>
          </Section>
        ) : null}

        <FeedbackReplay
          eventData={eventData}
          feedbackItem={feedbackItem}
          organization={organization}
        />

        <Section icon={<IconTag size="xs" />} title={t('Tags')}>
          <TagsSection tags={tags} />
        </Section>

        {feedbackItem.project ? (
          <Section
            icon={<IconChat size="xs" />}
            title={
              <Fragment>
                {t('Internal Activity')}
                <QuestionTooltip
                  size="xs"
                  title={t(
                    'Use this section to post comments that are visible only to your organization. It will also automatically update when someone resolves or assigns the feedback.'
                  )}
                />
              </Fragment>
            }
          >
            <FeedbackActivitySection feedbackItem={feedbackItem as unknown as Group} />
          </Section>
        ) : null}
      </OverflowPanelItem>
    </Fragment>
  );
}

function TraceDataSection({
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

  // Note a timeline will only be shown for >1 same-trace issues.
  return show && organization.features.includes('user-feedback-trace-section') ? (
    <Section>
      <IssueDetailsTraceDataSection event={eventData} />
    </Section>
  ) : null;
}

// 0 padding-bottom because <ActivitySection> has space(2) built-in.
const OverflowPanelItem = styled(PanelItem)`
  overflow: auto;

  flex-direction: column;
  flex-grow: 1;
  gap: ${space(2)};
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
`;
