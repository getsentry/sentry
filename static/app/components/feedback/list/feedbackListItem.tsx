import {CSSProperties} from 'react';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/featureBadge';
import FeedbackItemUsername from 'sentry/components/feedback/feedbackItem/feedbackItemUsername';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import Link from 'sentry/components/links/link';
import {Flex} from 'sentry/components/profiling/flex';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  FeedbackItemLoaderQueryParams,
  HydratedFeedbackItem,
} from 'sentry/utils/feedback/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

interface Props {
  feedbackItem: HydratedFeedbackItem;
  className?: string;
  style?: CSSProperties;
}

const ReplayBadge = styled(props => (
  <span {...props}>
    <IconPlay size="xs" />
    {t('Replay')}
  </span>
))`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
`;

function UnreadBadge() {
  return <FeatureBadge type="new" variant="indicator" />;
}

export default function FeedbackListItem({className, feedbackItem, style}: Props) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const location = useLocation<FeedbackItemLoaderQueryParams>();
  const feedbackSlug = decodeScalar(location.query.feedbackSlug);
  const [, feedbackId] = feedbackSlug?.split(':') ?? [];

  const isSelected = feedbackId === feedbackItem.feedback_id;

  const project = projects.find(p => p.id === String(feedbackItem.project_id));
  if (!project) {
    // TODO[feedback]: Guard against invalid test data that has no valid project.
    return null;
  }

  return (
    <Wrapper
      className={className}
      style={style}
      data-selected={isSelected}
      to={{
        pathname: normalizeUrl(`/organizations/${organization.slug}/feedback/`),
        query: {
          referrer: 'feedback_list_page',
          feedbackSlug: `${project.slug}:${feedbackItem.feedback_id}`,
        },
      }}
      onClick={() => {
        trackAnalytics('feedback_list.details_link.click', {organization});
      }}
    >
      <InteractionStateLayer />
      <Flex column style={{gridArea: 'right'}}>
        <input type="checkbox" />
        <UnreadBadge />
      </Flex>
      <strong style={{gridArea: 'user'}}>
        <FeedbackItemUsername feedbackItem={feedbackItem} />
      </strong>
      <span style={{gridArea: 'time'}}>
        <TimeSince date={feedbackItem.timestamp} />
      </span>
      <div style={{gridArea: 'message'}}>
        <TextOverflow>{feedbackItem.message}</TextOverflow>
      </div>
      <Flex style={{gridArea: 'icons'}}>
        {feedbackItem.replay_id ? <ReplayBadge /> : null}
      </Flex>
    </Wrapper>
  );
}

const Wrapper = styled(Link)`
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(1)} ${space(0.75)};

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
    'right user time'
    'right message message'
    'right icons icons';
  gap: ${space(1)};
  place-items: stretch;
`;
