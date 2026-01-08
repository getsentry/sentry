import styled from '@emotion/styled';

import {ActorAvatar} from 'sentry/components/core/avatar/actorAvatar';
import {Checkbox} from 'sentry/components/core/checkbox';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import IssueTrackingSignals from 'sentry/components/feedback/list/issueTrackingSignals';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {IconChat, IconFatal, IconImage, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import feedbackHasLinkedError from 'sentry/utils/feedback/hasLinkedError';
import {type FeedbackIssueListItem} from 'sentry/utils/feedback/types';
import {decodeScalar} from 'sentry/utils/queryString';
import useReplayCountForFeedbacks from 'sentry/utils/replayCount/useReplayCountForFeedbacks';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {makeFeedbackPathname} from 'sentry/views/feedback/pathnames';

interface Props {
  feedbackItem: FeedbackIssueListItem;
  isSelected: 'all-selected' | boolean;
  onItemSelect: () => void;
  onSelect: (isSelected: boolean) => void;
}

function useIsSelectedFeedback({feedbackItem}: {feedbackItem: FeedbackIssueListItem}) {
  const {feedbackSlug} = useLocationQuery({
    fields: {feedbackSlug: decodeScalar},
  });
  const [, feedbackId] = feedbackSlug.split(':') ?? [];
  return feedbackId === feedbackItem.id;
}

export default function FeedbackListItem({
  feedbackItem,
  isSelected,
  onSelect,
  onItemSelect,
}: Props) {
  const organization = useOrganization();
  const isOpen = useIsSelectedFeedback({feedbackItem});
  const {feedbackHasReplay} = useReplayCountForFeedbacks();
  const hasReplayId = feedbackHasReplay(feedbackItem.id);
  const location = useLocation();

  const hasLinkedError = feedbackHasLinkedError(feedbackItem);
  const hasAttachments = feedbackItem.latestEventHasAttachments;
  const hasComments = feedbackItem.numComments > 0;

  return (
    <CardSpacing>
      <LinkedFeedbackCard
        data-selected={isOpen}
        to={{
          pathname: makeFeedbackPathname({
            path: '/',
            organization,
          }),
          query: {
            ...location.query,
            referrer: 'feedback_list_page',
            feedbackSlug: `${feedbackItem.project?.slug}:${feedbackItem.id}`,
          },
        }}
        onClick={() => {
          trackAnalytics('feedback.list-item-selected', {organization});
          onItemSelect();
        }}
      >
        <InteractionStateLayer />

        <Row
          style={{gridArea: 'checkbox'}}
          onClick={e => {
            e.stopPropagation();
          }}
        >
          <Checkbox
            disabled={isSelected === 'all-selected'}
            checked={isSelected !== false}
            onChange={e => {
              onSelect(e.target.checked);
            }}
          />
        </Row>

        <ContactRow>
          {feedbackItem.metadata.name ??
            feedbackItem.metadata.contact_email ??
            t('Anonymous User')}
        </ContactRow>

        <StyledTimeSince date={feedbackItem.firstSeen} />

        {feedbackItem.hasSeen ? null : (
          <DotRow style={{gridArea: 'unread'}}>
            <Tooltip title={t('Unread')} skipWrapper>
              <UnreadIndicator />
            </Tooltip>
          </DotRow>
        )}

        <PreviewRow
          align="start"
          justify="start"
          style={{
            gridArea: 'message',
          }}
        >
          <StyledTextOverflow>{feedbackItem.metadata.message}</StyledTextOverflow>
        </PreviewRow>

        <BottomGrid style={{gridArea: 'bottom'}}>
          <Row justify="start" gap="sm">
            {feedbackItem.project ? (
              <StyledProjectBadge
                disableLink
                project={feedbackItem.project}
                avatarSize={14}
                hideName
                avatarProps={{hasTooltip: false}}
              />
            ) : null}
            <ShortId>{feedbackItem.shortId}</ShortId>
          </Row>

          <Row justify="end" gap="md">
            <IssueTrackingSignals group={feedbackItem as unknown as Group} />

            {hasComments && (
              <Tooltip title={t('Has Activity')} containerDisplayMode="flex">
                <IconChat variant="muted" size="xs" />
              </Tooltip>
            )}

            {hasLinkedError && (
              <Tooltip title={t('Linked Error')} containerDisplayMode="flex">
                <IconFatal variant="danger" size="xs" />
              </Tooltip>
            )}

            {hasReplayId && (
              <Tooltip title={t('Linked Replay')} containerDisplayMode="flex">
                <IconPlay size="xs" variant="muted" />
              </Tooltip>
            )}

            {hasAttachments && (
              <Tooltip title={t('Has Screenshot')} containerDisplayMode="flex">
                <IconImage size="xs" variant="muted" />
              </Tooltip>
            )}

            {feedbackItem.assignedTo && (
              <ActorAvatar
                actor={feedbackItem.assignedTo}
                size={16}
                tooltipOptions={{containerDisplayMode: 'flex'}}
              />
            )}
          </Row>
        </BottomGrid>
      </LinkedFeedbackCard>
    </CardSpacing>
  );
}

const LinkedFeedbackCard = styled(Link)`
  position: relative;
  padding: ${space(1)} ${space(3)} ${space(1)} ${space(1.5)};
  border: 1px solid transparent;
  border-radius: ${space(0.75)};

  color: ${p => p.theme.tokens.content.primary};
  &:hover {
    color: ${p => p.theme.tokens.content.primary};
  }
  &[data-selected='true'] {
    background: ${p =>
      p.theme.tokens.interactive.transparent.accent.selected.background.rest};
    border: 1px solid ${p => p.theme.tokens.border.transparent.accent.muted};
    border-radius: ${space(0.75)};
    color: ${p => p.theme.tokens.interactive.transparent.accent.content.primary};
  }

  display: grid;
  grid-template-columns: max-content 1fr max-content;
  grid-template-rows: max-content 1fr max-content;
  grid-template-areas:
    'checkbox user time'
    'unread message message'
    '. bottom bottom';
  gap: ${space(0.5)} ${space(1)};
  place-items: stretch;
  align-items: center;
`;

const Row = styled(Flex)`
  place-items: center;
`;

const BottomGrid = styled('div')`
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${space(1)};

  overflow: hidden;
`;

const StyledProjectBadge = styled(ProjectBadge)`
  && img {
    box-shadow: none;
  }
`;

const PreviewRow = styled(Row)`
  align-items: flex-start;
  font-size: ${p => p.theme.fontSize.sm};
  padding-bottom: ${space(0.75)};
`;

const DotRow = styled(Row)`
  height: 1.1em;
  align-items: flex-start;
  justify-content: center;
`;

const UnreadIndicator = styled('div')`
  width: 8px;
  height: 8px;
  background-color: ${p => p.theme.colors.blue500};
  border-radius: 50%;
`;

const StyledTextOverflow = styled(TextOverflow)`
  white-space: initial;
  height: 1.4em;
  -webkit-line-clamp: 1;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-height: ${p => p.theme.text.lineHeightBody};
`;

const ContactRow = styled(TextOverflow)`
  font-size: ${p => p.theme.fontSize.md};
  grid-area: 'user';
  font-weight: bold;
`;

const ShortId = styled(TextOverflow)`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const StyledTimeSince = styled(TimeSince)`
  font-size: ${p => p.theme.fontSize.sm};
  grid-area: 'time';
`;

const CardSpacing = styled('div')`
  padding: ${space(0.5)} ${space(0.5)} 0 ${space(0.5)};
`;
