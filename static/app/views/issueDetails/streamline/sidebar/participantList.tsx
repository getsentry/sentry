import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import AvatarList from 'sentry/components/core/avatar/avatarList';
import ScheduleAvatar from 'sentry/components/core/avatar/scheduleAvatar';
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
import type {RotationSchedule} from 'sentry/views/escalationPolicies/queries/useFetchRotationSchedules';

interface DropdownListProps {
  users: User[];
  hideTimestamp?: boolean;
  maxVisibleAvatars?: number;
  schedules?: RotationSchedule[];
  teams?: Team[];
}

export default function ParticipantList({
  users,
  teams,
  schedules,
  maxVisibleAvatars,
  hideTimestamp,
}: DropdownListProps) {
  const {overlayProps, isOpen, triggerProps} = useOverlay({
    position: 'bottom-start',
    shouldCloseOnBlur: true,
    isKeyboardDismissDisabled: false,
  });

  users = users || [];
  teams = teams || [];
  schedules = schedules || [];
  const theme = useTheme();
  const showHeaders =
    Number(users.length > 0) + Number(teams.length > 0) + Number(schedules.length > 0) >
    1;

  maxVisibleAvatars = maxVisibleAvatars || 3;
  return (
    <div>
      <Button borderless translucentBorder size="zero" {...triggerProps}>
        <StyledAvatarList
          teams={teams}
          users={users}
          schedules={schedules}
          avatarSize={24}
          maxVisibleAvatars={maxVisibleAvatars}
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
              {showHeaders && (
                <ListTitle>{t('Rotation Schedules (%s)', schedules.length)}</ListTitle>
              )}
              {schedules.map(schedule => (
                <UserRow key={schedule.id}>
                  <ScheduleAvatar schedule={schedule} size={20} />
                  <div>{schedule.name}</div>
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
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.textColor};

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
