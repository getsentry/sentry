import {Fragment} from 'react';

import AvatarList from 'sentry/components/avatar/avatarList';
import DateTime from 'sentry/components/dateTime';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {AvatarUser} from 'sentry/types';
import type {HydratedFeedbackItem} from 'sentry/utils/feedback/item/types';
import {userDisplayName} from 'sentry/utils/formatters';

interface Props {
  feedbackItem: HydratedFeedbackItem;
}

export default function FeedbackViewers({feedbackItem}: Props) {
  const displayUsers = feedbackItem.seenBy;

  return (
    <Tooltip title={t('People who have viewed this report')}>
      <AvatarList
        users={displayUsers}
        avatarSize={28}
        maxVisibleAvatars={13}
        tooltipOptions={{position: 'bottom'}}
        renderTooltip={user => (
          <Fragment>
            {userDisplayName(user)}
            <br />
            <DateTime date={(user as AvatarUser).lastSeen} />
          </Fragment>
        )}
      />
    </Tooltip>
  );
}
