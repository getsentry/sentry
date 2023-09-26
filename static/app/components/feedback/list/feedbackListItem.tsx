import {CSSProperties} from 'react';
import styled from '@emotion/styled';

import FeatureBadge from 'sentry/components/featureBadge';
import FeedbackItemUsername from 'sentry/components/feedback/feedbackItem/feedbackItemUsername';
import {Flex} from 'sentry/components/profiling/flex';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {HydratedFeedbackItem} from 'sentry/utils/feedback/types';

interface Props {
  feedbackItem: HydratedFeedbackItem;
  isSelected: boolean;
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

export default function FeedbackListItem({
  className,
  feedbackItem,
  isSelected,
  style,
}: Props) {
  return (
    <Wrapper className={className} style={style} data-selected={isSelected}>
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

const Wrapper = styled('div')`
  padding: ${space(1)} ${space(0.75)};

  &[data-selected='true'] {
    background: ${p => p.theme.purple300};
    border-radius: ${p => p.theme.borderRadius};
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
