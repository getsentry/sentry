import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {TeamAvatar} from 'sentry/components/core/avatar/teamAvatar';
import {UserAvatar} from 'sentry/components/core/avatar/userAvatar';
import {Button} from 'sentry/components/core/button';
import {IconChevron} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';

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
          <UserAvatar user={user} size={28} />
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
              variant="muted"
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
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};

  & > div:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }

  & > div:first-child {
    border-top-left-radius: ${p => p.theme.radius.md};
    border-top-right-radius: ${p => p.theme.radius.md};
  }

  & > div:last-child {
    border-bottom-left-radius: ${p => p.theme.radius.md};
    border-bottom-right-radius: ${p => p.theme.radius.md};
  }
`;

const ListTitle = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(1)} ${space(1.5)};
  background-color: ${p => p.theme.tokens.background.secondary};
  color: ${p => p.theme.tokens.content.secondary};
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
`;

const SubText = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.xs};
`;
