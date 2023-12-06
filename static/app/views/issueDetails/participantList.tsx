import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import Avatar from 'sentry/components/avatar';
import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import {Button} from 'sentry/components/button';
import {IconChevron} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Team, User} from 'sentry/types';

interface ParticipantScrollboxProps {
  teams: Team[];
  users: User[];
}

function ParticipantScrollbox({users, teams}: ParticipantScrollboxProps) {
  if (!users.length && !teams.length) {
    return null;
  }

  const showHeaders = users.length > 0 && teams.length > 0;

  return (
    <ParticipantListWrapper>
      {showHeaders && <ListTitle>{t('Teams (%s)', teams.length)}</ListTitle>}
      {teams.map(team => (
        <UserRow key={team.id}>
          <TeamAvatar team={team} size={28} />
          <div>
            {`#${team.slug}`}
            <SubText>{tn('%s member', '%s members', team.memberCount)}</SubText>
          </div>
        </UserRow>
      ))}
      {showHeaders && <ListTitle>{t('Individuals (%s)', users.length)}</ListTitle>}
      {users.map(user => (
        <UserRow key={user.id}>
          <Avatar user={user} size={28} />
          <div>
            {user.name}
            <SubText>{user.email}</SubText>
          </div>
        </UserRow>
      ))}
    </ParticipantListWrapper>
  );
}

interface ParticipantListProps {
  children: React.ReactNode;
  description: string;
  users: User[];
  teams?: Team[];
}

export function ParticipantList({teams = [], users, children}: ParticipantListProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Fragment>
      <ParticipantWrapper onClick={() => setIsExpanded(!isExpanded)} role="button">
        {children}
        <Button
          borderless
          size="zero"
          icon={
            <IconChevron
              direction={isExpanded ? 'up' : 'down'}
              size="xs"
              color="gray300"
            />
          }
          aria-label={t('%s Participants', isExpanded ? t('Collapse') : t('Expand'))}
          onClick={() => setIsExpanded(!isExpanded)}
        />
      </ParticipantWrapper>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            variants={{
              open: {height: '100%', opacity: 1, overflow: 'initial'},
              closed: {height: '0', opacity: 0, overflow: 'hidden'},
            }}
            initial="closed"
            animate="open"
            exit="closed"
          >
            <ParticipantScrollbox users={users} teams={teams} />
          </motion.div>
        )}
      </AnimatePresence>
    </Fragment>
  );
}

const ParticipantWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  padding-bottom: ${space(1)};

  & > span {
    cursor: pointer;
  }
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
  font-weight: 600;
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
