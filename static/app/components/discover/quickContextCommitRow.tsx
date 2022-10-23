import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import CommitLink from 'sentry/components/commitLink';
import {PanelItem} from 'sentry/components/panels';
import TextOverflow from 'sentry/components/textOverflow';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import space from 'sentry/styles/space';
import {Commit} from 'sentry/types';

import {formatCommitMessage} from '../commitRow';
import ExternalLink from '../links/externalLink';

interface QuickContextCommitRowProps {
  commit: Commit;
  customAvatar?: React.ReactNode;
}

function QuickContextCommitRow({commit, customAvatar}: QuickContextCommitRowProps) {
  const user = ConfigStore.get('user');
  const isUser = user?.id === commit.author?.id;
  const hasPullRequestURL = commit.pullRequest && commit.pullRequest.externalUrl;

  return (
    <StyledPanelItem key={commit.id} data-test-id="commit-row">
      {customAvatar
        ? customAvatar
        : commit.author && (
            <div>
              <UserAvatar size={24} user={commit.author} />
            </div>
          )}

      <CommitLinks>
        {hasPullRequestURL && commit.message && (
          <ToPullRequest>
            <ExternalLink href={commit.pullRequest?.externalUrl}>
              {formatCommitMessage(commit.message)}
            </ExternalLink>
          </ToPullRequest>
        )}
        <ToCommit isSubText={hasPullRequestURL && commit.message}>
          {tct('View commit [commitLink] by [author]', {
            author: isUser ? t('You') : commit.author?.name ?? t('Unknown author'),
            commitLink: (
              <CommitLink
                inline
                showIcon={false}
                commitId={commit.id}
                repository={commit.repository}
              />
            ),
          })}
        </ToCommit>
      </CommitLinks>
    </StyledPanelItem>
  );
}

const StyledPanelItem = styled(PanelItem)`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding: 0;
  border: none;

  & + & {
    margin-top: ${space(1)};
  }
`;

const CommitLinks = styled('div')`
  flex: 1;
  flex-direction: column;
  min-width: 0;
`;

const ToPullRequest = styled(TextOverflow)`
  font-size: ${p => p.theme.fontSizeLarge};
  line-height: 1.2;
`;

const ToCommit = styled(TextOverflow)<{isSubText: string | null | undefined}>`
  font-size: ${p => (p.isSubText ? p.theme.fontSizeSmall : p.theme.fontSizeLarge)};
  color: ${p => (p.isSubText ? p.theme.subText : p.theme.textColor)};
  line-height: 1.5;
  margin: 0;
`;

export {QuickContextCommitRow};
