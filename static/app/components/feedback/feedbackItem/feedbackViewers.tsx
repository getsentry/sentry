import {Fragment} from 'react';

import AvatarList from 'sentry/components/avatar/avatarList';
import DateTime from 'sentry/components/dateTime';
import type {AvatarUser} from 'sentry/types';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';
import {userDisplayName} from 'sentry/utils/formatters';

interface Props {
  feedbackItem: HydratedFeedbackItem;
}

export default function FeedbackViewers({feedbackItem: _}: Props) {
  const displayUsers = [
    {
      email: 'colton.allen@sentry.io',
      id: '1',
      ip_address: '',
      name: 'Colton Allen',
      username: 'cmanallen',
    },
  ];

  return (
    <AvatarList
      users={displayUsers}
      avatarSize={28}
      maxVisibleAvatars={13}
      renderTooltip={user => (
        <Fragment>
          {userDisplayName(user)}
          <br />
          <DateTime date={(user as AvatarUser).lastSeen} />
        </Fragment>
      )}
    />
  );
}
