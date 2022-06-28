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
      // try to not have ellipsis mid-word
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
      <div className="commit">
        <div className="commit-avatar">
          <UserAvatar user={commitAuthor || unknownUser} />
        </div>
        <div className="commit-message truncate">{renderMessage(commit.message)}</div>
        <div className="commit-meta">
          <strong>{commitAuthor?.name || t('Unknown Author')}</strong>
          &nbsp;
          <TimeSince date={commit.dateCreated} />
        </div>
      </div>
    </div>
  );
}

export default LastCommit;
