import {CSSProperties, forwardRef} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

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
  isChecked: boolean;
  onChecked: (isChecked: boolean) => void;
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
  ({className, feedbackItem, isChecked, onChecked, style}: Props, ref) => {
    const organization = useOrganization();
    const isSelected = useIsSelectedFeedback({feedbackItem});
    const hasReplayId = useFeedbackHasReplayId({feedbackId: feedbackItem.id});

    return (
      <CardSpacing className={className} style={style} ref={ref}>
        <LinkedFeedbackCard
          data-selected={isSelected}
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
              checked={isChecked}
              onChange={e => onChecked(e.target.checked)}
              onClick={e => e.stopPropagation()}
            />
          </Flex>
          <Flex column style={{gridArea: 'right'}}>
            {''}
          </Flex>
          <TextOverflow>
            <span style={{gridArea: 'user'}}>
              <FeedbackItemUsername feedbackIssue={feedbackItem} detailDisplay={false} />
            </span>
          </TextOverflow>
          <span style={{gridArea: 'time'}}>
            <TimeSince date={feedbackItem.firstSeen} />
          </span>
          {feedbackItem.hasSeen ? null : (
            <span
              style={{
                gridArea: 'unread',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <IconCircleFill size="xs" color="purple300" />
            </span>
          )}
          <div style={{gridArea: 'message'}}>
            <TextOverflow>{feedbackItem.metadata.message}</TextOverflow>
          </div>
          <Flex style={{gridArea: 'icons'}} gap={space(1)} align="center">
            <Flex align="center" gap={space(0.5)}>
              <ProjectAvatar project={feedbackItem.project} size={12} />
              {feedbackItem.project.slug}
            </Flex>

            {hasReplayId ? (
              <Flex align="center" gap={space(0.5)}>
                <IconPlay size="xs" />
                {t('Replay')}
              </Flex>
            ) : null}
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
    'right icons icons';
  gap: ${space(1)};
  place-items: stretch;
  align-items: center;
`;

export default FeedbackListItem;
