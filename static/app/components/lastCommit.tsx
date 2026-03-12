import styled from '@emotion/styled';

import {UserAvatar} from '@sentry/scraps/avatar';

import {CommitLink} from 'sentry/components/commitLink';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import type {Commit} from 'sentry/types/integrations';
import type {AvatarUser} from 'sentry/types/user';

type Props = {
  commit: Commit;
};

const unknownUser: AvatarUser = {
  id: '',
  name: '',
  username: '??',
  email: '',
  avatarUrl: '',
  avatar: {
    avatarUuid: '',
    avatarType: 'letter_avatar',
  },
  ip_address: '',
};

export function LastCommit({commit}: Props) {
  function renderMessage(message: Commit['message']) {
    if (!message) {
      return (
        <StyledCommitLink
          inline
          commitId={commit.id}
          repository={commit.repository}
          showIcon={false}
        />
      );
    }

    let finalMessage = message.split(/\n/)[0]!;
    if (finalMessage.length > 100) {
      let truncated = finalMessage.substring(0, 90);
      const words = truncated.split(/ /);
      // try to not have ellipsis mid-word
      if (words.length > 1) {
        words.pop();
        truncated = words.join(' ');
      }
      finalMessage = `${truncated}\u2026`;
    }

    return (
      <StyledCommitLink
        inline
        commitId={commit.id}
        repository={commit.repository}
        commitTitle={finalMessage}
        showIcon={false}
      />
    );
  }

  const commitAuthor = commit?.author;
  return (
    <div>
      <h6>Last commit</h6>
      <div>
        <Message>{renderMessage(commit.message)}</Message>
        <Meta>
          <UserAvatar user={commitAuthor || unknownUser} size={14} />
          <strong>{commitAuthor?.name || t('Unknown Author')}</strong>
          <TimeSince date={commit.dateCreated} />
        </Meta>
      </div>
    </div>
  );
}

const Message = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: ${p => p.theme.space.xs};
`;

const Meta = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  font-size: ${p => p.theme.font.size.sm};
  color: ${p => p.theme.tokens.content.secondary};
`;

const StyledCommitLink = styled(CommitLink)`
  color: ${p => p.theme.tokens.content.primary};
  &:hover {
    color: ${p => p.theme.tokens.content.primary};
    text-decoration: underline dotted ${p => p.theme.tokens.content.primary};
  }
`;
