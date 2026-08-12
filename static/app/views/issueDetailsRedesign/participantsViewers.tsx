import {useMemo} from 'react';
import styled from '@emotion/styled';

import {AvatarList, TeamAvatar, UserAvatar} from '@sentry/scraps/avatar';
import {Stack} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import {DateTime} from 'sentry/components/dateTime';
import {t, tn} from 'sentry/locale';
import type {Group, TeamParticipant, UserParticipant} from 'sentry/types/group';
import type {AvatarUser, User} from 'sentry/types/user';
import {useUser} from 'sentry/utils/useUser';

interface ParticipantsViewersProps {
  group: Group;
}

function PersonRow({user, team}: {team?: TeamParticipant; user?: User | AvatarUser}) {
  const lastSeen = (user as AvatarUser | undefined)?.lastSeen;
  return (
    <Row>
      {team ? (
        <TeamAvatar team={team} size={24} />
      ) : user ? (
        <UserAvatar user={user} size={24} />
      ) : null}
      <Details>
        <Name>{team ? `#${team.slug}` : (user?.name ?? user?.email)}</Name>
        {team ? (
          <Sub>{tn('%s member', '%s members', team.memberCount)}</Sub>
        ) : user?.email && user.email !== user.name ? (
          <Sub>{user.email}</Sub>
        ) : null}
      </Details>
      {lastSeen && <Timestamp date={lastSeen} />}
    </Row>
  );
}

/**
 * A compact header affordance that combines an issue's participants and viewers
 * into a single stacked avatar cluster. Shows the top two avatars followed by a
 * "+N" overflow; hovering reveals a dropdown that splits the full list into
 * "Participants" and "Viewers" sections with names, emails and timestamps.
 */
export function ParticipantsViewers({group}: ParticipantsViewersProps) {
  const activeUser = useUser();

  const {userParticipants, teamParticipants, viewers} = useMemo(
    () => ({
      userParticipants: group.participants.filter(
        (p): p is UserParticipant => p.type === 'user'
      ),
      teamParticipants: group.participants.filter(
        (p): p is TeamParticipant => p.type === 'team'
      ),
      viewers: group.seenBy.filter(viewer => viewer.id !== activeUser.id),
    }),
    [group.participants, group.seenBy, activeUser.id]
  );

  const hasParticipants = userParticipants.length > 0 || teamParticipants.length > 0;
  const hasViewers = viewers.length > 0;

  if (!hasParticipants && !hasViewers) {
    return null;
  }

  // Stacked avatar preview combines everyone; participants render first.
  const previewUsers: Array<User | AvatarUser> = [...userParticipants, ...viewers];

  return (
    <Tooltip
      isHoverable
      skipWrapper
      maxWidth={360}
      title={
        <Stack gap="lg">
          {hasParticipants && (
            <Section>
              <SectionTitle>{t('Participants')}</SectionTitle>
              {teamParticipants.map(team => (
                <PersonRow key={`team-${team.id}`} team={team} />
              ))}
              {userParticipants.map(user => (
                <PersonRow key={`user-${user.id}`} user={user} />
              ))}
            </Section>
          )}
          {hasViewers && (
            <Section>
              <SectionTitle>{t('Viewers')}</SectionTitle>
              {viewers.map(user => (
                <PersonRow key={`viewer-${user.id}`} user={user} />
              ))}
            </Section>
          )}
        </Stack>
      }
    >
      <TriggerWrapper aria-label={t('Participants and viewers')}>
        <BorderlessAvatarList
          users={previewUsers}
          teams={teamParticipants}
          avatarSize={24}
          maxVisibleAvatars={2}
          typeAvatars={t('people')}
        />
      </TriggerWrapper>
    </Tooltip>
  );
}

const TriggerWrapper = styled('div')`
  display: inline-flex;
  cursor: default;
`;

// The default AvatarList draws a ring border around each avatar; the redesign
// wants plain, borderless avatars.
const BorderlessAvatarList = styled(AvatarList)`
  & > * {
    border: none;
  }
`;

const Section = styled('div')`
  display: flex;
  flex-direction: column;
`;

const SectionTitle = styled('div')`
  text-transform: uppercase;
  font-size: ${p => p.theme.font.size.xs};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  color: ${p => p.theme.tokens.content.secondary};
  margin-bottom: ${p => p.theme.space.xs};
  text-align: left;
`;

const Row = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.xs} 0;
  text-align: left;
`;

const Details = styled('div')`
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
`;

const Name = styled('div')`
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.primary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Sub = styled('div')`
  font-size: ${p => p.theme.font.size.xs};
  color: ${p => p.theme.tokens.content.secondary};
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Timestamp = styled(DateTime)`
  flex-shrink: 0;
  font-size: ${p => p.theme.font.size.xs};
  color: ${p => p.theme.tokens.content.secondary};
`;
