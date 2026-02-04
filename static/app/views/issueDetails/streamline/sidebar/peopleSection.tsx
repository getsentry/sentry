import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {TeamParticipant, UserParticipant} from 'sentry/types/group';
import type {User} from 'sentry/types/user';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import ParticipantList from 'sentry/views/issueDetails/streamline/sidebar/participantList';

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
    <SidebarFoldSection
      title={<Title>{t('People')}</Title>}
      sectionKey={SectionKey.PEOPLE}
    >
      {hasParticipants && (
        <Flex gap="xs" align="center">
          <ParticipantList
            users={userParticipants}
            teams={teamParticipants}
            hideTimestamp
          />
          {t('participating')}
        </Flex>
      )}
      {hasViewers && (
        <Flex gap="xs" align="center">
          <ParticipantList users={viewers} />
          {t('viewed')}
        </Flex>
      )}
    </SidebarFoldSection>
  );
}

const Title = styled('div')`
  font-size: ${p => p.theme.font.size.md};
`;
