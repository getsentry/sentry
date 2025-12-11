import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import AvatarList from 'sentry/components/core/avatar/avatarList';
import {TeamAvatar} from 'sentry/components/core/avatar/teamAvatar';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import {DateTime} from 'sentry/components/dateTime';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Team} from 'sentry/types/organization';
import type {AvatarUser, User} from 'sentry/types/user';
import {userDisplayName} from 'sentry/utils/formatters';
import useOverlay from 'sentry/utils/useOverlay';

interface DropdownListProps {
  users: User[];
  hideTimestamp?: boolean;
  teams?: Team[];
}

export default function ParticipantList({
  users,
  teams,
  hideTimestamp,
}: DropdownListProps) {
  const {overlayProps, isOpen, triggerProps} = useOverlay({
    position: 'bottom-start',
    shouldCloseOnBlur: true,
    isKeyboardDismissDisabled: false,
  });

  const theme = useTheme();
  const showHeaders = users.length > 0 && teams && teams.length > 0;

  return (
    <div>
      <Button borderless translucentBorder size="zero" {...triggerProps}>
        <StyledAvatarList
          teams={teams}
          users={users}
          avatarSize={24}
          maxVisibleAvatars={3}
          renderTooltip={user => (
            <Fragment>
              {userDisplayName(user)}
              {!hideTimestamp && (
                <Fragment>
                  <br />
                  <LastSeen date={(user as AvatarUser).lastSeen} />
                </Fragment>
              )}
            </Fragment>
          )}
        />
      </Button>
      {isOpen && (
        <PositionWrapper zIndex={theme.zIndex.dropdown} {...overlayProps}>
          <StyledOverlay>
            <ParticipantListWrapper>
              {showHeaders && teams && teams.length > 0 && (
                <ListTitle>{t('Teams (%s)', teams.length)}</ListTitle>
              )}
              {teams?.map(team => (
                <UserRow key={team.id}>
                  <TeamAvatar team={team} size={20} />
                  <div>
                    {`#${team.slug}`}
                    <SmallText>
                      {tn('%s member', '%s members', team.memberCount)}
                    </SmallText>
                  </div>
                </UserRow>
              ))}
              {showHeaders && (
                <ListTitle>{t('Individuals (%s)', users.length)}</ListTitle>
              )}
              {users.map(user => (
                <UserRow key={user.id}>
                  <UserAvatar user={user} size={20} />
                  <NameWrapper>
                    <div>{user.name}</div>
                    {user.email === user.name ? null : (
                      <SmallText>{user.email}</SmallText>
                    )}
                    {!hideTimestamp && <LastSeen date={(user as AvatarUser).lastSeen} />}
                  </NameWrapper>
                </UserRow>
              ))}
            </ParticipantListWrapper>
          </StyledOverlay>
        </PositionWrapper>
      )}
    </div>
  );
}

const StyledOverlay = styled(Overlay)`
  display: flex;
  flex-direction: column;
`;

const ParticipantListWrapper = styled('div')`
  max-height: 325px;
  overflow-y: auto;
  border-radius: ${p => p.theme.radius.md};
  color: ${p => p.theme.tokens.content.primary};

  & > div:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const ListTitle = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  background-color: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.subText};
  text-transform: uppercase;
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.sm};
`;

const UserRow = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  gap: ${space(1)};
  line-height: 1.2;
  font-size: ${p => p.theme.fontSize.sm};
  min-height: 45px;
`;

const NameWrapper = styled('div')`
  & > div:only-child {
    margin-top: ${space(0.25)};
  }
`;

const SmallText = styled('div')`
  font-size: ${p => p.theme.fontSize.xs};
`;

const StyledAvatarList = styled(AvatarList)`
  justify-content: flex-end;
  padding-left: ${space(0.75)};
`;

const LastSeen = styled(DateTime)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.xs};
`;
