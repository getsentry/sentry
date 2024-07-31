import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {FocusScope} from '@react-aria/focus';

import Avatar from 'sentry/components/avatar';
import AvatarList from 'sentry/components/avatar/avatarList';
import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Team, User} from 'sentry/types';
import useOverlay from 'sentry/utils/useOverlay';

interface DropdownListProps {
  users: User[];
  teams?: Team[];
}

export default function DropdownList({users, teams}: DropdownListProps) {
  const {overlayProps, isOpen, triggerProps} = useOverlay({
    position: 'bottom-start',
  });

  const theme = useTheme();

  return (
    <UserDropdown>
      <div {...triggerProps}>
        <StyledAvatarList users={users} avatarSize={24} maxVisibleAvatars={3} />
      </div>
      {isOpen && (
        <FocusScope contain restoreFocus autoFocus>
          <PositionWrapper zIndex={theme.zIndex.dropdown} {...overlayProps}>
            <StyledOverlay>
              <ParticipantListWrapper>
                {teams && teams.length > 0 && (
                  <ListTitle>{t('Teams (%s)', teams.length)}</ListTitle>
                )}
                {teams?.map(team => (
                  <UserRow key={team.id}>
                    <TeamAvatar team={team} size={20} />
                    <div>
                      {`#${team.slug}`}
                      <SubText>{tn('%s member', '%s members', team.memberCount)}</SubText>
                    </div>
                  </UserRow>
                ))}
                {<ListTitle>{t('Individuals (%s)', users.length)}</ListTitle>}
                {users.map(user => (
                  <UserRow key={user.id}>
                    <Avatar user={user} size={20} />
                    <div>
                      {user.name}
                      <SubText>{user.email}</SubText>
                    </div>
                  </UserRow>
                ))}
              </ParticipantListWrapper>
            </StyledOverlay>
          </PositionWrapper>
        </FocusScope>
      )}
    </UserDropdown>
  );
}

const StyledOverlay = styled(Overlay)`
  display: flex;
  flex-direction: column;
`;

const ParticipantListWrapper = styled('div')`
  max-height: 325px;
  overflow-y: auto;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};

  & > div:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }

  & > div:first-child {
    border-top-left-radius: ${p => p.theme.borderRadius};
    border-top-right-radius: ${p => p.theme.borderRadius};
  }

  & > div:last-child {
    border-bottom-left-radius: ${p => p.theme.borderRadius};
    border-bottom-right-radius: ${p => p.theme.borderRadius};
  }
`;

const ListTitle = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  background-color: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.gray300};
  text-transform: uppercase;
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const UserRow = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  gap: ${space(1)};
  line-height: 1.2;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const SubText = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

const StyledAvatarList = styled(AvatarList)`
  justify-content: flex-end;
  padding-left: ${space(0.75)};
`;

const UserDropdown = styled('div')`
  &:hover {
    cursor: pointer;
  }
`;
