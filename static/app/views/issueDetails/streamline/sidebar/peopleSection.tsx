import {Flex} from 'sentry/components/container/flex';
import ParticipantList from 'sentry/components/group/streamlinedParticipantList';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TeamParticipant, UserParticipant} from 'sentry/types/group';
import type {User} from 'sentry/types/user';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/streamline/sidebar/sidebar';

export default function PeopleSection({
  userParticipants,
  teamParticipants,
  viewers,
}: {
  teamParticipants: TeamParticipant[];
  userParticipants: UserParticipant[];
  viewers: User[];
}) {
  const hasParticipants = userParticipants.length > 0 || teamParticipants.length > 0;
  const hasViewers = viewers.length > 0;

  return (
    <div>
      <SidebarSectionTitle>{t('People')}</SidebarSectionTitle>
      {hasParticipants && (
        <Flex gap={space(0.5)} align="center">
          <ParticipantList users={userParticipants} teams={teamParticipants} />
          {t('participating')}
        </Flex>
      )}
      {hasViewers && (
        <Flex gap={space(0.5)} align="center">
          <ParticipantList users={viewers} />
          {t('viewed')}
        </Flex>
      )}
    </div>
  );
}
