import styled from '@emotion/styled';

import {ActivityItem} from 'sentry/components/activity/item';
import {Button} from 'sentry/components/button';
import {IconCopy} from 'sentry/icons';
import type {AvatarUser} from 'sentry/types';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/types';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';

interface Props {
  feedback: HydratedFeedbackItem;
}
export default function FeedbackActivityItem({feedback}: Props) {
  const user: AvatarUser = {
    email: feedback.user.email ?? '',
    id: feedback.user.id ?? '',
    ip_address: feedback.user.ip ?? '',
    name: feedback.user.display_name ?? '',
    username: feedback.user.username ?? '',
    ip: feedback.user.ip ?? '',
  };

  return (
    <ActivityItem
      author={{
        type: 'user',
        user,
      }}
      date={feedback.timestamp}
      header={<FeedbackActivityHeader feedback={feedback} />}
    >
      <p>{feedback.message}</p>
    </ActivityItem>
  );
}

function FeedbackActivityHeader({feedback}: Props) {
  const {onClick, label} = useCopyToClipboard({text: feedback.contact_email});

  return (
    <div>
      <CopyButton
        aria-label={label}
        borderless
        onClick={onClick}
        size="zero"
        title={label}
        tooltipProps={{delay: 0}}
        translucentBorder
        icon={<IconCopy size="xs" />}
      >
        {feedback.contact_email}
      </CopyButton>
    </div>
  );
}

const CopyButton = styled(Button)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: normal;
`;
