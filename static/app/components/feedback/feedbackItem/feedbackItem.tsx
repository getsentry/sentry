import {Fragment} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import CrashReportSection from 'sentry/components/feedback/feedbackItem/crashReportSection';
import FeedbackActivitySection from 'sentry/components/feedback/feedbackItem/feedbackActivitySection';
import FeedbackItemHeader from 'sentry/components/feedback/feedbackItem/feedbackItemHeader';
import Section from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import FeedbackViewers from 'sentry/components/feedback/feedbackItem/feedbackViewers';
import ReplayInlineCTAPanel from 'sentry/components/feedback/feedbackItem/replayInlineCTAPanel';
import ReplaySection from 'sentry/components/feedback/feedbackItem/replaySection';
import TagsSection from 'sentry/components/feedback/feedbackItem/tagsSection';
import PanelItem from 'sentry/components/panels/panelItem';
import {Flex} from 'sentry/components/profiling/flex';
import QuestionTooltip from 'sentry/components/questionTooltip';
import TextCopyInput from 'sentry/components/textCopyInput';
import {replayPlatforms} from 'sentry/data/platformCategories';
import {IconChat, IconFire, IconLink, IconPlay, IconTag} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import useReplayCountForFeedbacks from 'sentry/utils/replayCount/useReplayCountForFeedbacks';
import {useHaveSelectedProjectsSentAnyReplayEvents} from 'sentry/utils/replays/hooks/useReplayOnboarding';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
  tags: Record<string, string>;
}

export default function FeedbackItem({feedbackItem, eventData, tags}: Props) {
  const organization = useOrganization();
  const {feedbackHasReplay} = useReplayCountForFeedbacks();
  const hasReplayId = feedbackHasReplay(feedbackItem.id);

  const url = eventData?.tags.find(tag => tag.key === 'url');
  const replayId = eventData?.contexts?.feedback?.replay_id;
  const crashReportId = eventData?.contexts?.feedback?.associated_event_id;

  const {hasSentOneReplay} = useHaveSelectedProjectsSentAnyReplayEvents();
  const platformSupported = replayPlatforms.includes(feedbackItem.platform);

  return (
    <Fragment>
      <FeedbackItemHeader eventData={eventData} feedbackItem={feedbackItem} />
      <OverflowPanelItem>
        <Section
          title={t('Description')}
          contentRight={
            <Flex gap={space(1)} align="center">
              <SmallTitle>{t('Viewers')}</SmallTitle>
              <FeedbackViewers feedbackItem={feedbackItem} />
            </Flex>
          }
        >
          <Blockquote>
            <pre>{feedbackItem.metadata.message}</pre>
          </Blockquote>
        </Section>

        <Section icon={<IconLink size="xs" />} title={t('URL')}>
          <TextCopyInput size="sm">
            {eventData?.tags ? (url ? url.value : t('URL not found')) : ''}
          </TextCopyInput>
        </Section>

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

        {hasReplayId && replayId ? (
          <Section icon={<IconPlay size="xs" />} title={t('Linked Replay')}>
            <ErrorBoundary mini>
              <ReplaySection
                eventTimestampMs={new Date(feedbackItem.firstSeen).getTime()}
                organization={organization}
                replayId={replayId}
              />
            </ErrorBoundary>
          </Section>
        ) : hasSentOneReplay || !platformSupported ? null : (
          <Section icon={<IconPlay size="xs" />} title={t('Linked Replay')}>
            <ReplayInlineCTAPanel />
          </Section>
        )}

        <Section icon={<IconTag size="xs" />} title={t('Tags')}>
          <TagsSection tags={tags} />
        </Section>

        <Section
          icon={<IconChat size="xs" />}
          title={
            <Fragment>
              {t('Activity')}
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

const OverflowPanelItem = styled(PanelItem)`
  overflow: scroll;

  flex-direction: column;
  flex-grow: 1;
  gap: ${space(4)};
  padding: ${space(2)} ${space(3)} 50px ${space(3)};
`;

const SmallTitle = styled('span')`
  font-size: ${p => p.theme.fontSizeRelativeSmall};
`;

const Blockquote = styled('blockquote')`
  margin: 0 ${space(4)};
  position: relative;

  &::after {
    position: absolute;
    border: 1px solid ${p => p.theme.purple300};
    bottom: 0;
    content: '';
    left: -${space(1)};
    top: 0;
  }

  & > pre {
    margin: 0;
    background: none;
    font-family: inherit;
    font-size: ${p => p.theme.fontSizeMedium};
    line-height: 1.6;
    padding: 0;
    word-break: break-word;
  }
`;
