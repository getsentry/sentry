import {CSSProperties, forwardRef, Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import ProjectAvatar from 'sentry/components/avatar/projectAvatar';
import Checkbox from 'sentry/components/checkbox';
import FeedbackItemUsername from 'sentry/components/feedback/feedbackItem/feedbackItemUsername';
import useFeedbackHasReplayId from 'sentry/components/feedback/useFeedbackHasReplayId';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {Flex} from 'sentry/components/profiling/flex';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {IconCircleFill, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {FeedbackIssue} from 'sentry/utils/feedback/types';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

interface Props {
  feedbackItem: FeedbackIssue;
  isSelected: 'all-selected' | boolean;
  onSelect: (isSelected: boolean) => void;
  className?: string;
  style?: CSSProperties;
}

function useIsSelectedFeedback({feedbackItem}: {feedbackItem: FeedbackIssue}) {
  const {feedbackSlug} = useLocationQuery({
    fields: {feedbackSlug: decodeScalar},
  });
  const [, feedbackId] = feedbackSlug.split(':') ?? [];
  return feedbackId === feedbackItem.id;
}

const FeedbackListItem = forwardRef<HTMLDivElement, Props>(
  ({className, feedbackItem, isSelected, onSelect, style}: Props, ref) => {
    const organization = useOrganization();
    const isOpen = useIsSelectedFeedback({feedbackItem});
    const hasReplayId = useFeedbackHasReplayId({feedbackId: feedbackItem.id});

    return (
      <CardSpacing className={className} style={style} ref={ref}>
        <LinkedFeedbackCard
          data-selected={isOpen}
          to={() => {
            const location = browserHistory.getCurrentLocation();
            return {
              pathname: normalizeUrl(`/organizations/${organization.slug}/feedback/`),
              query: {
                ...location.query,
                referrer: 'feedback_list_page',
                feedbackSlug: `${feedbackItem.project.slug}:${feedbackItem.id}`,
              },
            };
          }}
          onClick={() => {
            trackAnalytics('feedback_list.details_link.click', {organization});
          }}
        >
          <InteractionStateLayer />
          <Flex column style={{gridArea: 'checkbox'}}>
            <Checkbox
              disabled={isSelected === 'all-selected'}
              checked={isSelected !== false}
              onChange={e => onSelect(e.target.checked)}
              onClick={e => e.stopPropagation()}
              invertColors={isOpen}
            />
          </Flex>
          <TextOverflow>
            <span style={{gridArea: 'user'}}>
              <FeedbackItemUsername feedbackIssue={feedbackItem} detailDisplay={false} />
            </span>
          </TextOverflow>
          <span style={{gridArea: 'time'}}>
            <TimeSince date={feedbackItem.firstSeen} />
          </span>
          <Flex justify="center" style={{gridArea: 'unread'}}>
            {feedbackItem.hasSeen ? null : (
              <IconCircleFill size="xs" color={isOpen ? 'white' : 'purple400'} />
            )}
          </Flex>
          <div style={{gridArea: 'message'}}>
            <TextOverflow>{feedbackItem.metadata.message}</TextOverflow>
          </div>
          <div style={{gridArea: 'assigned', display: 'flex', justifyContent: 'end'}}>
            {feedbackItem.assignedTo ? (
              <ActorAvatar actor={feedbackItem.assignedTo} size={16} />
            ) : null}
          </div>
          <Flex style={{gridArea: 'icons'}} gap={space(1)} align="center">
            <Flex align="center" gap={space(0.5)}>
              <ProjectAvatar project={feedbackItem.project} size={12} />
              <ProjectOverflow>{feedbackItem.project.slug}</ProjectOverflow>
              {hasReplayId ? (
                <Fragment>
                  <IconPlay size="xs" />
                  {t('Replay')}
                </Fragment>
              ) : null}
            </Flex>
          </Flex>
        </LinkedFeedbackCard>
      </CardSpacing>
    );
  }
);

const CardSpacing = styled('div')`
  padding: ${space(0.25)} ${space(0.5)};
`;

const LinkedFeedbackCard = styled(Link)`
  position: relative;
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)} ${space(1.5)} ${space(1)} ${space(1.5)};

  color: ${p => p.theme.textColor};
  &:hover {
    color: ${p => p.theme.textColor};
  }
  &[data-selected='true'] {
    background: ${p => p.theme.purple300};
    color: white;
  }

  display: grid;
  grid-template-columns: max-content 1fr max-content;
  grid-template-rows: max-content 1fr max-content;
  grid-template-areas:
    'checkbox user time'
    'unread message message'
    '. icons assigned';
  gap: ${space(1)};
  place-items: stretch;
  align-items: center;
`;

const ProjectOverflow = styled('span')`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  max-width: 150px;
`;

export default FeedbackListItem;
