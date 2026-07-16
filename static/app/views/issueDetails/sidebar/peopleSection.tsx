import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';

import {t} from 'sentry/locale';
import type {TeamParticipant, UserParticipant} from 'sentry/types/group';
import type {User} from 'sentry/types/user';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {SidebarFoldSection} from 'sentry/views/issueDetails/foldSection';
import {ParticipantList} from 'sentry/views/issueDetails/sidebar/participantList';

export function PeopleSection({
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
      <Stack gap="md">
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
      </Stack>
    </SidebarFoldSection>
  );
}

const Title = styled('div')`
  font-size: ${p => p.theme.font.size.md};
`;
