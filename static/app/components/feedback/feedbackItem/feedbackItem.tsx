import {Fragment, useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import CrashReportSection from 'sentry/components/feedback/feedbackItem/crashReportSection';
import FeedbackActivitySection from 'sentry/components/feedback/feedbackItem/feedbackActivitySection';
import FeedbackItemHeader from 'sentry/components/feedback/feedbackItem/feedbackItemHeader';
import Section from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import FeedbackReplay from 'sentry/components/feedback/feedbackItem/feedbackReplay';
import MessageSection from 'sentry/components/feedback/feedbackItem/messageSection';
import {ScreenshotSection} from 'sentry/components/feedback/feedbackItem/screenshotSection';
import TagsSection from 'sentry/components/feedback/feedbackItem/tagsSection';
import PanelItem from 'sentry/components/panels/panelItem';
import QuestionTooltip from 'sentry/components/questionTooltip';
import TextCopyInput from 'sentry/components/textCopyInput';
import {IconChat, IconFire, IconLink, IconTag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
  tags: Record<string, string>;
}

export default function FeedbackItem({feedbackItem, eventData, tags}: Props) {
  const organization = useOrganization();
  const url = eventData?.tags.find(tag => tag.key === 'url');
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
      <FeedbackItemHeader eventData={eventData} feedbackItem={feedbackItem} />
      <OverflowPanelItem ref={overflowRef}>
        <Section>
          <MessageSection eventData={eventData} feedbackItem={feedbackItem} />
        </Section>

        {eventData && (
          <ScreenshotSection
            event={eventData}
            organization={organization}
            projectSlug={feedbackItem.project.slug}
          />
        )}

        {!crashReportId || (crashReportId && url) ? (
          <Section icon={<IconLink size="xs" />} title={t('URL')}>
            <TextCopyInput size="sm">
              {eventData?.tags ? (url ? url.value : t('URL not found')) : ''}
            </TextCopyInput>
          </Section>
        ) : null}

        {crashReportId && (
          <Section icon={<IconFire size="xs" />} title={t('Linked Error')}>
            <ErrorBoundary mini>
              <CrashReportSection
                organization={organization}
                crashReportId={crashReportId}
                projectSlug={feedbackItem.project.slug}
              />
            </ErrorBoundary>
          </Section>
        )}

        <FeedbackReplay
          eventData={eventData}
          feedbackItem={feedbackItem}
          organization={organization}
        />

        <Section icon={<IconTag size="xs" />} title={t('Tags')}>
          <TagsSection tags={tags} />
        </Section>

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
          <FeedbackActivitySection feedbackItem={feedbackItem} />
        </Section>
      </OverflowPanelItem>
    </Fragment>
  );
}

// 0 padding-bottom because <ActivitySection> has space(2) built-in.
const OverflowPanelItem = styled(PanelItem)`
  overflow: scroll;

  flex-direction: column;
  flex-grow: 1;
  gap: ${space(2)};
  padding: ${space(2)} ${space(3)} 0 ${space(3)};
`;
