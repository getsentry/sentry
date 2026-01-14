import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex, Stack} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {IconBranch, IconCommit, IconFile, IconGithub} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import type {
  PullRequestDetailsSuccessResponse,
  PullRequestState,
} from 'sentry/views/pullRequest/types/pullRequestDetailsTypes';

interface PullRequestDetailsHeaderContentProps {
  pullRequest: PullRequestDetailsSuccessResponse;
}

export function PullRequestDetailsHeaderContent({
  pullRequest,
}: PullRequestDetailsHeaderContentProps) {
  const {pull_request: pr} = pullRequest;

  return (
    <Stack gap="md" paddingTop="md" paddingBottom="md">
      <Flex justify="between" align="start">
        <Stack gap="sm">
          <Heading as="h1">
            #{pr.number}: {pr.title || 'Untitled'}
          </Heading>
          <Flex gap="lg" align="center">
            {getPrStateBadge(pr.state)}
            <Flex gap="sm" align="center">
              {pr.author.avatar_url && <GitHubAvatar src={pr.author.avatar_url} />}
              {pr.author.username && (
                <Text variant="muted" size="sm">
                  {pr.author.username}
                </Text>
              )}
            </Flex>
            <Flex gap="xs" align="center">
              <IconBranch />
              <BranchLabel size="sm" monospace variant="muted">
                {pr.source_branch}
              </BranchLabel>
            </Flex>
            <Flex gap="xs" align="center">
              <Text size="sm" variant="success" bold>
                +{pr.additions}
              </Text>
              <Text size="sm" variant="muted">
                /
              </Text>
              <Text size="sm" variant="danger" bold>
                -{pr.deletions}
              </Text>
            </Flex>
            <Flex gap="xs" align="center">
              <IconCommit size="xs" />
              <Text size="sm" variant="muted">
                {tn('%s commit', '%s commits', pr.commits_count)}
              </Text>
            </Flex>
            <Flex gap="xs" align="center">
              <IconFile size="xs" />
              <Text size="sm" variant="muted">
                {tn('%s file', '%s files', pr.changed_files_count)}
              </Text>
            </Flex>
          </Flex>
        </Stack>
        {pr.url && (
          <LinkButton icon={<IconGithub size="sm" />} href={pr.url} external>
            {t('View on GitHub')}
          </LinkButton>
        )}
      </Flex>

      {pr.description && (
        <Container background="secondary" radius="md" padding="md">
          <Text>{pr.description}</Text>
        </Container>
      )}
    </Stack>
  );
}

function getPrStateBadge(state: PullRequestState): React.ReactNode | null {
  switch (state) {
    case 'open':
      return <Tag variant="success">Open</Tag>;
    case 'closed':
      return <Tag variant="danger">Closed</Tag>;
    case 'merged':
      return <Tag variant="info">Merged</Tag>;
    case 'draft':
      return <Tag variant="muted">Draft</Tag>;
    default:
      return null;
  }
}

const GitHubAvatar = styled('img')`
  width: 20px;
  height: 20px;
  border-radius: 50%;
`;

const BranchLabel = styled(Text)`
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  background-color: ${p => p.theme.colors.gray100};
  border-radius: ${p => p.theme.radius.md};
`;
