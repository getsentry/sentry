import {Fragment} from 'react';
import styled from '@emotion/styled';

import AvatarList from 'sentry/components/avatar/avatarList';
import DateTime from 'sentry/components/dateTime';
import QuestionTooltip from 'sentry/components/questionTooltip';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {AvatarUser} from 'sentry/types';
import {userDisplayName} from 'sentry/utils/formatters';

export default function FeedbackViewers() {
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
    <SidebarSection.Wrap>
      <SidebarSection.Title>
        {t('Viewers (%s)', displayUsers.length)}{' '}
        <QuestionTooltip
          size="xs"
          position="top"
          title={t('People who have viewed this issue')}
        />
      </SidebarSection.Title>
      <SidebarSection.Content>
        <StyledAvatarList
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
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}

const StyledAvatarList = styled(AvatarList)`
  justify-content: flex-end;
  padding-left: ${space(0.75)};
`;
