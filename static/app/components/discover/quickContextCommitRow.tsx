import styled from '@emotion/styled';

import UserAvatar from 'sentry/components/avatar/userAvatar';
import CommitLink from 'sentry/components/commitLink';
import {CommitRowProps, formatCommitMessage} from 'sentry/components/commitRow';
import ExternalLink from 'sentry/components/links/externalLink';
import PanelItem from 'sentry/components/panels/panelItem';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';

function QuickContextCommitRow({commit}: CommitRowProps) {
  const user = ConfigStore.get('user');
  const isUser = user?.id === commit.author?.id;
  const hasPullRequestURL = commit.pullRequest && commit.pullRequest.externalUrl;
  const commitMessage = formatCommitMessage(commit.message);

  return (
    <StyledPanelItem key={commit.id} data-test-id="quick-context-commit-row">
      <UserAvatar size={24} user={commit.author} />
      <CommitLinks>
        {hasPullRequestURL && commit.message && (
          <Tooltip containerDisplayMode="inline" showOnlyOnOverflow title={commitMessage}>
            <LinkToPullRequest data-test-id="quick-context-commit-row-pr-link">
              <ExternalLink href={commit.pullRequest?.externalUrl}>
                {commitMessage}
              </ExternalLink>
            </LinkToPullRequest>
          </Tooltip>
        )}
        <LinkToCommit
          hasPrTitle={hasPullRequestURL && commit.message}
          data-test-id="quick-context-commit-row-commit-link"
        >
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
        </LinkToCommit>
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

const LinkToPullRequest = styled(TextOverflow)`
  font-size: ${p => p.theme.fontSizeLarge};
  line-height: 1.2;
`;

const LinkToCommit = styled(TextOverflow)<{hasPrTitle: string | null | undefined}>`
  font-size: ${p => (p.hasPrTitle ? p.theme.fontSizeSmall : p.theme.fontSizeLarge)};
  color: ${p => (p.hasPrTitle ? p.theme.subText : p.theme.textColor)};
  line-height: 1.5;
  margin: 0;
`;

export {QuickContextCommitRow};
