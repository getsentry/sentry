import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import CommitLink from 'sentry/components/commitLink';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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

function LastCommit({commit}: Props) {
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

export default LastCommit;

const Message = styled('div')`
  ${p => p.theme.overflowEllipsis}
  margin-bottom: ${space(0.5)};
`;

const Meta = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;

const StyledCommitLink = styled(CommitLink)`
  color: ${p => p.theme.textColor};
  &:hover {
    color: ${p => p.theme.textColor};
    text-decoration: underline dotted ${p => p.theme.textColor};
  }
`;
