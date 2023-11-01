import {Fragment} from 'react';
import styled from '@emotion/styled';

import AvatarList from 'sentry/components/avatar/avatarList';
import DateTime from 'sentry/components/dateTime';
import {space} from 'sentry/styles/space';
import type {AvatarUser} from 'sentry/types';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import {userDisplayName} from 'sentry/utils/formatters';

interface Props {
  feedbackItem: FeedbackIssue;
}
export default function FeedbackViewers({feedbackItem}: Props) {
  const displayUsers = feedbackItem.seenBy;

  return (
    <StyledAvatarList
      users={displayUsers}
      avatarSize={28}
      maxVisibleAvatars={5}
      tooltipOptions={{position: 'top'}}
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

const StyledAvatarList = styled(AvatarList)`
  flex-direction: end;
  margin-left: ${space(0.75)};
`;
