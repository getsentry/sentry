import {useMemo} from 'react';

import {Flex} from 'sentry/components/container/flex';
import ParticipantList from 'sentry/components/group/streamlinedParticipantList';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group, TeamParticipant, UserParticipant} from 'sentry/types/group';
import {useUser} from 'sentry/utils/useUser';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/streamline/sidebar';

export default function PeopleSection({group}: {group: Group}) {
  const activeUser = useUser();
  const {userParticipants, teamParticipants, viewers} = useMemo(() => {
    return {
      userParticipants: group.participants.filter(
        (p): p is UserParticipant => p.type === 'user'
      ),
      teamParticipants: group.participants.filter(
        (p): p is TeamParticipant => p.type === 'team'
      ),
      viewers: group.seenBy.filter(user => activeUser.id !== user.id),
    };
  }, [group, activeUser.id]);

  const hasParticipants = group.participants.length > 0;
  const hasViewers = viewers.length > 0;

  if (!hasParticipants && !hasViewers) {
    return null;
  }

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
