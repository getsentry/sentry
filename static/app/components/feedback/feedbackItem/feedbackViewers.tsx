import {Fragment} from 'react';

import AvatarList from 'sentry/components/avatar/avatarList';
import DateTime from 'sentry/components/dateTime';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {AvatarUser} from 'sentry/types';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import {userDisplayName} from 'sentry/utils/formatters';

interface Props {
  feedbackItem: FeedbackIssue;
}

export default function FeedbackViewers({feedbackItem}: Props) {
  const displayUsers = feedbackItem.seenBy;

  return (
    <Tooltip title={t('People who have viewed this feedback')}>
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
