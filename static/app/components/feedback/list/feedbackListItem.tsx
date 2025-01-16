import type {CSSProperties} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import Checkbox from 'sentry/components/checkbox';
import {Flex} from 'sentry/components/container/flex';
import IssueTrackingSignals from 'sentry/components/feedback/list/issueTrackingSignals';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChat, IconCircleFill, IconFatal, IconImage, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {FeedbackIssueListItem} from 'sentry/utils/feedback/types';
import {decodeScalar} from 'sentry/utils/queryString';
import useReplayCountForFeedbacks from 'sentry/utils/replayCount/useReplayCountForFeedbacks';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  feedbackItem: FeedbackIssueListItem;
  isSelected: 'all-selected' | boolean;
  onSelect: (isSelected: boolean) => void;
  style?: CSSProperties;
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
  style,
}: Props) {
  const organization = useOrganization();
  const isOpen = useIsSelectedFeedback({feedbackItem});
  const {feedbackHasReplay} = useReplayCountForFeedbacks();
  const hasReplayId = feedbackHasReplay(feedbackItem.id);
  const location = useLocation();

  const isCrashReport = feedbackItem.metadata.source === 'crash_report_embed_form';
  const isUserReportWithError = feedbackItem.metadata.source === 'user_report_envelope';
  const hasAttachments = feedbackItem.latestEventHasAttachments;
  const hasComments = feedbackItem.numComments > 0;

  return (
    <CardSpacing style={style}>
      <LinkedFeedbackCard
        data-selected={isOpen}
        to={{
          pathname: normalizeUrl(`/organizations/${organization.slug}/feedback/`),
          query: {
            ...location.query,
            referrer: 'feedback_list_page',
            feedbackSlug: `${feedbackItem.project?.slug}:${feedbackItem.id}`,
          },
        }}
        onClick={() => {
          trackAnalytics('feedback.list-item-selected', {organization});
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
            <IconCircleFill size="xs" color="purple400" />
          </DotRow>
        )}

        <PreviewRow
          align="flex-start"
          justify="flex-start"
          style={{
            gridArea: 'message',
          }}
        >
          <StyledTextOverflow>{feedbackItem.metadata.message}</StyledTextOverflow>
        </PreviewRow>

        <BottomGrid style={{gridArea: 'bottom'}}>
          <Row justify="flex-start" gap={space(0.75)}>
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

          <Row justify="flex-end" gap={space(1)}>
            <IssueTrackingSignals group={feedbackItem as unknown as Group} />

            {hasComments && (
              <Tooltip title={t('Has Activity')} containerDisplayMode="flex">
                <IconChat color="gray500" size="sm" />
              </Tooltip>
            )}

            {(isCrashReport || isUserReportWithError) && (
              <Tooltip title={t('Linked Error')} containerDisplayMode="flex">
                <IconFatal color="red400" size="xs" />
              </Tooltip>
            )}

            {hasReplayId && (
              <Tooltip title={t('Linked Replay')} containerDisplayMode="flex">
                <IconPlay size="xs" />
              </Tooltip>
            )}

            {hasAttachments && (
              <Tooltip title={t('Has Screenshot')} containerDisplayMode="flex">
                <IconImage size="xs" />
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

  color: ${p => p.theme.textColor};
  &:hover {
    color: ${p => p.theme.textColor};
  }
  &[data-selected='true'] {
    background: ${p => p.theme.purple100};
    border: 1px solid ${p => p.theme.purple200};
    border-radius: ${space(0.75)};
    color: ${p => p.theme.purple300};
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
  font-size: ${p => p.theme.fontSizeSmall};
  padding-bottom: ${space(0.75)};
`;

const DotRow = styled(Row)`
  height: 1.1em;
  align-items: flex-start;
  justify-content: center;
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
  font-size: ${p => p.theme.fontSizeMedium};
  grid-area: 'user';
  font-weight: bold;
`;

const ShortId = styled(TextOverflow)`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
`;

const StyledTimeSince = styled(TimeSince)`
  font-size: ${p => p.theme.fontSizeSmall};
  grid-area: 'time';
`;

const CardSpacing = styled('div')`
  padding: ${space(0.5)} ${space(0.5)} 0 ${space(0.5)};
`;
