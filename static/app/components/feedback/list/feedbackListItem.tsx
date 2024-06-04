import type {CSSProperties} from 'react';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import Checkbox from 'sentry/components/checkbox';
import {Flex} from 'sentry/components/container/flex';
import IssueTrackingSignals from 'sentry/components/feedback/list/issueTrackingSignals';
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
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import {decodeScalar} from 'sentry/utils/queryString';
import useReplayCountForFeedbacks from 'sentry/utils/replayCount/useReplayCountForFeedbacks';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

interface Props {
  feedbackItem: FeedbackIssue;
  isSelected: 'all-selected' | boolean;
  onSelect: (isSelected: boolean) => void;
  style?: CSSProperties;
}

function useIsSelectedFeedback({feedbackItem}: {feedbackItem: FeedbackIssue}) {
  const {feedbackSlug} = useLocationQuery({
    fields: {feedbackSlug: decodeScalar},
  });
  const [, feedbackId] = feedbackSlug.split(':') ?? [];
  return feedbackId === feedbackItem.id;
}

function FeedbackListItem({feedbackItem, isSelected, onSelect, style}: Props) {
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
    <LinkedFeedbackCard
      style={style}
      data-selected={isOpen}
      to={{
        pathname: normalizeUrl(`/organizations/${organization.slug}/feedback/`),
        query: {
          ...location.query,
          referrer: 'feedback_list_page',
          feedbackSlug: `${feedbackItem.project.slug}:${feedbackItem.id}`,
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

      <TextOverflow style={{gridArea: 'user'}}>
        <strong>
          {feedbackItem.metadata.name ??
            feedbackItem.metadata.contact_email ??
            t('Anonymous User')}
        </strong>
      </TextOverflow>

      <TimeSince date={feedbackItem.firstSeen} style={{gridArea: 'time'}} />

      {feedbackItem.hasSeen ? null : (
        <DotRow style={{gridArea: 'unread'}}>
          <IconCircleFill size="xs" color="purple400" />
        </DotRow>
      )}

      <PreviewRow align="flex-start" justify="flex-start" style={{gridArea: 'message'}}>
        <StyledTextOverflow>{feedbackItem.metadata.message}</StyledTextOverflow>
      </PreviewRow>

      <BottomGrid style={{gridArea: 'bottom'}}>
        <Row justify="flex-start" gap={space(0.75)}>
          <StyledProjectAvatar
            project={feedbackItem.project}
            size={12}
            title={feedbackItem.project.slug}
          />
          <TextOverflow>{feedbackItem.shortId}</TextOverflow>
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
  );
}

const LinkedFeedbackCard = styled(Link)`
  position: relative;
  padding: ${space(1)} ${space(3)} ${space(1)} ${space(1.5)};

  color: ${p => p.theme.textColor};
  &:hover {
    color: ${p => p.theme.textColor};
  }
  &[data-selected='true'] {
    background: ${p => p.theme.purple100};
  }
  &[data-selected='true']::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    height: 100%;
    background: ${p => p.theme.purple300};
    width: ${space(0.5)};
    z-index: 10;
  }

  display: grid;
  grid-template-columns: max-content 1fr max-content;
  grid-template-rows: max-content 1fr max-content;
  grid-template-areas:
    'checkbox user time'
    'unread message message'
    '. bottom bottom';
  gap: ${space(1)};
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

const StyledProjectAvatar = styled(ProjectAvatar)`
  && img {
    box-shadow: none;
  }
`;

const PreviewRow = styled(Row)`
  height: 2.8em;
  align-items: flex-start;
`;

const DotRow = styled(Row)`
  height: 2.2em;
  align-items: flex-start;
  justify-content: center;
`;

const StyledTextOverflow = styled(TextOverflow)`
  white-space: initial;
  height: 2.8em;
  -webkit-line-clamp: 2;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  line-height: ${p => p.theme.text.lineHeightBody};
`;
export default FeedbackListItem;
