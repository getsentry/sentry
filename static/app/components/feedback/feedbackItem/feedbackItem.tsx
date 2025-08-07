import {Fragment, useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import AnalyticsArea from 'sentry/components/analyticsArea';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {getOrderedContextItems} from 'sentry/components/events/contexts';
import ContextCard from 'sentry/components/events/contexts/contextCard';
import EventTagsTree from 'sentry/components/events/eventTags/eventTagsTree';
import CrashReportSection from 'sentry/components/feedback/feedbackItem/crashReportSection';
import FeedbackActivitySection from 'sentry/components/feedback/feedbackItem/feedbackActivitySection';
import FeedbackItemHeader from 'sentry/components/feedback/feedbackItem/feedbackItemHeader';
import FeedbackItemSection from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import FeedbackReplay from 'sentry/components/feedback/feedbackItem/feedbackReplay';
import FeedbackUrl from 'sentry/components/feedback/feedbackItem/feedbackUrl';
import MessageSection from 'sentry/components/feedback/feedbackItem/messageSection';
import TraceDataSection from 'sentry/components/feedback/feedbackItem/traceDataSection';
import {KeyValueData} from 'sentry/components/keyValueData';
import PanelItem from 'sentry/components/panels/panelItem';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconChat, IconFire, IconTag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
}

export default function FeedbackItem({feedbackItem, eventData}: Props) {
  const organization = useOrganization();
  const crashReportId = eventData?.contexts?.feedback?.associated_event_id;

  const overflowRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setTimeout(() => {
      overflowRef.current?.scrollTo({
        top: 0,
        behavior: 'smooth',
      });
    }, 100);
  }, [feedbackItem.id, overflowRef]);

  return (
    <Fragment>
      <AnalyticsArea name="details">
        <FeedbackItemHeader eventData={eventData} feedbackItem={feedbackItem} />
        <OverflowPanelItem ref={overflowRef}>
          <FeedbackItemSection sectionKey="message">
            <MessageSection eventData={eventData} feedbackItem={feedbackItem} />
          </FeedbackItemSection>

          <FeedbackUrl eventData={eventData} feedbackItem={feedbackItem} />

          {crashReportId && feedbackItem.project ? (
            <FeedbackItemSection
              collapsible
              icon={<IconFire size="xs" />}
              sectionKey="crash-report"
              title={t('Linked Error')}
            >
              <ErrorBoundary mini>
                <CrashReportSection
                  organization={organization}
                  crashReportId={crashReportId}
                  projectSlug={feedbackItem.project.slug}
                />
              </ErrorBoundary>
            </FeedbackItemSection>
          ) : null}

          <FeedbackReplay
            eventData={eventData}
            feedbackItem={feedbackItem}
            organization={organization}
          />

          {eventData ? (
            <ErrorBoundary mini>
              <TraceDataSection eventData={eventData} crashReportId={crashReportId} />
            </ErrorBoundary>
          ) : null}

          {eventData && feedbackItem.project ? (
            <FeedbackItemSection
              collapsible
              icon={<IconTag size="xs" />}
              sectionKey="tags"
              title={t('Tags')}
            >
              <EventTagsTree
                event={eventData}
                projectSlug={feedbackItem.project.slug}
                tags={eventData.tags}
              />
            </FeedbackItemSection>
          ) : null}

          {eventData ? (
            <FeedbackItemSection
              collapsible
              icon={<IconTag size="xs" />}
              sectionKey="context"
              title={t('Context')}
            >
              <FeedbackItemContexts
                feedbackItem={feedbackItem}
                eventData={eventData}
                project={feedbackItem.project}
              />
            </FeedbackItemSection>
          ) : null}

          {feedbackItem.project ? (
            <FeedbackItemSection
              collapsible
              icon={<IconChat size="xs" />}
              sectionKey="activity"
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
            </FeedbackItemSection>
          ) : null}
        </OverflowPanelItem>
      </AnalyticsArea>
    </Fragment>
  );
}

function FeedbackItemContexts({
  eventData,
  feedbackItem,
  project,
}: {
  eventData: Event;
  feedbackItem: FeedbackIssue;
  project: undefined | Project;
}) {
  const cards = getOrderedContextItems(eventData).map(
    ({alias, type, value: contextValue}) => (
      <ContextCard
        key={alias}
        type={type}
        alias={alias}
        value={contextValue}
        event={eventData}
        group={feedbackItem as unknown as Group}
        project={project}
      />
    )
  );

  if (!cards.length) {
    return null;
  }

  return (
    <ErrorBoundary mini message={t('There was a problem loading event context.')}>
      <KeyValueData.Container>{cards}</KeyValueData.Container>
    </ErrorBoundary>
  );
}

// 0 padding-bottom because <ActivitySection> has space(2) built-in.
const OverflowPanelItem = styled(PanelItem)`
  overflow: auto;

  flex-direction: column;
  flex-grow: 1;
  gap: ${space(2)};
  padding: ${space(2)} ${space(2)} 0 ${space(2)};
`;
