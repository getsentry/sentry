import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {AvatarUser, Commit} from 'sentry/types';

type Props = {
  commit: Commit;
  headerClass: string;
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

function LastCommit({commit, headerClass}: Props) {
  function renderMessage(message: Commit['message']) {
    if (!message) {
      return t('No message provided');
    }

    const firstLine = message.split(/\n/)[0];
    if (firstLine.length > 100) {
      let truncated = firstLine.substr(0, 90);
      const words = truncated.split(/ /);
      // try to not have elipsis mid-word
      if (words.length > 1) {
        words.pop();
        truncated = words.join(' ');
      }
      return `${truncated}\u2026`;
    }
    return firstLine;
  }

  const commitAuthor = commit?.author;
  return (
    <div>
      <h6 className={headerClass}>Last commit</h6>
      <CommitWrapper>
        <CommitAvatar>
          <UserAvatar user={commitAuthor || unknownUser} />
        </CommitAvatar>
        <CommitMessage className="truncate">
          {renderMessage(commit.message)}
        </CommitMessage>
        <div className="commit-meta">
          <strong>{commitAuthor?.name || t('Unknown Author')}</strong>
          &nbsp;
          <TimeSince date={commit.dateCreated} />
        </div>
      </CommitWrapper>
    </div>
  );
}

const CommitWrapper = styled('div')`
  margin-top: 5px;
  margin-bottom: 20px;
  position: relative;
  padding: 1px 0 0 25px;
  font-size: 13px;
`;

const CommitAvatar = styled('div')`
  position: absolute;
  width: 19px;
  height: 19px;
  top: 2px;
  left: 0;

  .avatar {
    width: 19px;
    height: 19px;
  }
`;

const CommitMessage = styled('div')`
  line-height: 1.4;
  margin: 2px 0 5px;
`;

export default LastCommit;
