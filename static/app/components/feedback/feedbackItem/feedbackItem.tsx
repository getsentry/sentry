import {Fragment} from 'react';
import styled from '@emotion/styled';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Button from 'sentry/components/actions/button';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import ErrorBoundary from 'sentry/components/errorBoundary';
import EventOrGroupExtraDetails from 'sentry/components/eventOrGroupExtraDetails';
import EventOrGroupHeader from 'sentry/components/eventOrGroupHeader';
import FeedbackAssignedTo from 'sentry/components/feedback/feedbackItem/feedbackAssignedTo';
import Section from 'sentry/components/feedback/feedbackItem/feedbackItemSection';
import FeedbackItemUsername from 'sentry/components/feedback/feedbackItem/feedbackItemUsername';
import FeedbackViewers from 'sentry/components/feedback/feedbackItem/feedbackViewers';
import ReplaySection from 'sentry/components/feedback/feedbackItem/replaySection';
import TagsSection from 'sentry/components/feedback/feedbackItem/tagsSection';
import useFeedbackHasReplayId from 'sentry/components/feedback/useFeedbackHasReplayId';
import useMutateFeedback from 'sentry/components/feedback/useMutateFeedback';
import PanelItem from 'sentry/components/panels/panelItem';
import {Flex} from 'sentry/components/profiling/flex';
import TextCopyInput from 'sentry/components/textCopyInput';
import TextOverflow from 'sentry/components/textOverflow';
import {IconIssues, IconLink} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types';
import {GroupStatus} from 'sentry/types';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  eventData: Event | undefined;
  feedbackItem: FeedbackIssue;
  tags: Record<string, string>;
}

export default function FeedbackItem({feedbackItem, eventData, tags}: Props) {
  const organization = useOrganization();
  const hasReplayId = useFeedbackHasReplayId({feedbackId: feedbackItem.id});
  const {markAsRead, resolve} = useMutateFeedback({
    feedbackIds: [feedbackItem.id],
    organization,
  });

  const url = eventData?.tags.find(tag => tag.key === 'url');
  const replayId = eventData?.contexts?.feedback?.replay_id;

  const mutationOptions = {
    onError: () => {
      addErrorMessage(t('An error occurred while updating the feedback.'));
    },
    onSuccess: () => {
      addSuccessMessage(t('Updated feedback'));
    },
  };

  const crashReportId = eventData?.contexts?.feedback?.associated_event_id;
  const endpoint = `/projects/${organization.slug}/${feedbackItem.project.slug}/events/${crashReportId}/`;
  const {data: crashReportData} = useApiQuery<Event>([endpoint], {staleTime: 0});

  return (
    <Fragment>
      <HeaderPanelItem>
        <Flex gap={space(2)} justify="space-between" wrap="wrap">
          <Flex column>
            <Flex align="center" gap={space(0.5)}>
              <FeedbackItemUsername feedbackIssue={feedbackItem} detailDisplay />
            </Flex>
            <Flex gap={space(0.5)} align="center">
              <ProjectAvatar
                project={feedbackItem.project}
                size={12}
                title={feedbackItem.project.slug}
              />
              <TextOverflow>{feedbackItem.project.slug}</TextOverflow>
            </Flex>
          </Flex>
          <Flex gap={space(1)} align="center" wrap="wrap">
            <ErrorBoundary mini>
              <FeedbackAssignedTo
                feedbackIssue={feedbackItem}
                feedbackEvent={eventData}
              />
            </ErrorBoundary>
            <ErrorBoundary mini>
              <Button
                onClick={() => {
                  addLoadingMessage(t('Updating feedback...'));
                  const newStatus =
                    feedbackItem.status === 'resolved'
                      ? GroupStatus.UNRESOLVED
                      : GroupStatus.RESOLVED;
                  resolve(newStatus, mutationOptions);
                }}
              >
                {feedbackItem.status === 'resolved' ? t('Unresolve') : t('Resolve')}
              </Button>
            </ErrorBoundary>
            <ErrorBoundary mini>
              <Button
                onClick={() => {
                  addLoadingMessage(t('Updating feedback...'));
                  markAsRead(!feedbackItem.hasSeen, mutationOptions);
                }}
              >
                {feedbackItem.hasSeen ? t('Mark Unread') : t('Mark Read')}
              </Button>
            </ErrorBoundary>
          </Flex>
        </Flex>
      </HeaderPanelItem>
      <OverflowPanelItem>
        <Section
          title={t('Description')}
          contentRight={
            <ErrorBoundary>
              <FeedbackViewers feedbackItem={feedbackItem} />
            </ErrorBoundary>
          }
        >
          <Blockquote>
            <pre>{feedbackItem.metadata.message}</pre>
          </Blockquote>
        </Section>
        <Section icon={<IconLink size="xs" />} title={t('Url')}>
          <ErrorBoundary mini>
            <TextCopyInput size="sm">
              {eventData?.tags ? (url ? url.value : t('URL not found')) : ''}
            </TextCopyInput>
          </ErrorBoundary>
        </Section>

        {feedbackItem.level === 'error' && crashReportData && (
          <Section icon={<IconIssues size="xs" />} title={t('Linked Issue')}>
            <ErrorBoundary mini>
              <IssueDetailsContainer>
                <EventOrGroupHeader
                  organization={organization}
                  data={crashReportData}
                  size="normal"
                />
                <EventOrGroupExtraDetails data={crashReportData} showInboxTime />
              </IssueDetailsContainer>
            </ErrorBoundary>
          </Section>
        )}
        {hasReplayId && replayId ? (
          <ReplaySection
            eventTimestampMs={new Date(feedbackItem.firstSeen).getTime()}
            organization={organization}
            replayId={replayId}
          />
        ) : null}
        <TagsSection tags={tags} />
      </OverflowPanelItem>
    </Fragment>
  );
}

const IssueDetailsContainer = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  position: relative;
  padding: ${space(1.5)} ${space(1.5)} ${space(1.5)} ${space(2)};
`;

const HeaderPanelItem = styled(PanelItem)`
  display: grid;
  padding: ${space(1)} ${space(2)};
`;

const OverflowPanelItem = styled(PanelItem)`
  overflow: scroll;

  flex-direction: column;
  flex-grow: 1;
  gap: ${space(3)};
`;

const Blockquote = styled('blockquote')`
  margin: 0 ${space(4)};
  position: relative;

  &::before {
    position: absolute;
    color: ${p => p.theme.purple300};
    content: '❝';
    font-size: ${space(4)};
    left: -${space(4)};
    top: -0.4rem;
  }
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
