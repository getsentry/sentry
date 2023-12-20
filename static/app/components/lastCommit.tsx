import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import CommitLink from 'sentry/components/commitLink';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {AvatarUser, Commit} from 'sentry/types';

type Props = {
  commit: Commit;
  className?: string;
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

function LastCommit({commit, className}: Props) {
  function renderMessage(message: Commit['message']) {
    if (!message) {
      return <CommitLink inline commitId={commit.id} repository={commit.repository} />;
    }

    let finalMessage = message.split(/\n/)[0];
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
      <CommitLink
        inline
        commitId={commit.id}
        repository={commit.repository}
        commitTitle={finalMessage}
      />
    );
  }

  const commitAuthor = commit?.author;
  return (
    <div className={className}>
      <h6>Last commit</h6>
      <InnerWrap>
        <UserAvatar user={commitAuthor || unknownUser} />
        <div>
          <Message>{renderMessage(commit.message)}</Message>
          <Meta>
            <strong>{commitAuthor?.name || t('Unknown Author')}</strong>
            &nbsp;
            <TimeSince date={commit.dateCreated} />
          </Meta>
        </div>
      </InnerWrap>
    </div>
  );
}

export default LastCommit;

const InnerWrap = styled('div')`
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: ${space(1)};
  margin-top: ${space(1)};
`;

const Message = styled('div')`
  ${p => p.theme.overflowEllipsis}
  margin-bottom: ${space(0.5)};
`;

const Meta = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.subText};
`;
