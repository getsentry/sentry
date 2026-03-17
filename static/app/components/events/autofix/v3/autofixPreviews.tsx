import {useMemo, type ReactNode} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {CodingAgentProvider} from 'sentry/components/events/autofix/types';
import type {
  RootCauseArtifact,
  SolutionArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {IconOpen} from 'sentry/icons';
import {IconBot} from 'sentry/icons/iconBot';
import {IconBug} from 'sentry/icons/iconBug';
import {IconCode} from 'sentry/icons/iconCode';
import {IconList} from 'sentry/icons/iconList';
import {IconPullRequest} from 'sentry/icons/iconPullRequest';
import {t, tn} from 'sentry/locale';
import {
  type Artifact,
  type ExplorerCodingAgentState,
  type ExplorerFilePatch,
  type RepoPRState,
} from 'sentry/views/seerExplorer/types';

interface RootCausePreviewProps {
  artifact: Artifact<RootCauseArtifact>;
}

export function RootCausePreview({artifact}: RootCausePreviewProps) {
  return (
    <ArtifactCard icon={<IconBug />} title={t('Root Cause')}>
      {artifact.data?.one_line_description}
    </ArtifactCard>
  );
}

interface SolutionPreviewProps {
  artifact: Artifact<SolutionArtifact>;
}

export function SolutionPreview({artifact}: SolutionPreviewProps) {
  return (
    <ArtifactCard icon={<IconList />} title={t('Implementation Plan')}>
      {artifact.data?.one_line_summary}
    </ArtifactCard>
  );
}

interface CodeChangesPreviewProps {
  artifact: ExplorerFilePatch[];
}

export function CodeChangesPreview({artifact}: CodeChangesPreviewProps) {
  const patchesForRepos = useMemo(() => {
    const patchesByRepo = new Map<string, ExplorerFilePatch[]>();
    for (const patch of artifact) {
      const existing = patchesByRepo.get(patch.repo_name) || [];
      existing.push(patch);
      patchesByRepo.set(patch.repo_name, existing);
    }
    return patchesByRepo;
  }, [artifact]);

  const summary = useMemo(() => {
    const reposChanged = patchesForRepos.size;

    const filesChanged = new Set<string>();

    for (const [repo, patchesForRepo] of patchesForRepos.entries()) {
      for (const patch of patchesForRepo) {
        filesChanged.add(`${repo}:${patch.patch.path}`);
      }
    }

    if (reposChanged === 0) {
      return t('No files changed');
    }

    if (reposChanged === 1) {
      return tn(
        '%s file changed in 1 repo',
        '%s files changed in 1 repo',
        filesChanged.size
      );
    }

    return t('%s files changed in %s repos', filesChanged.size, reposChanged);
  }, [patchesForRepos]);

  return (
    <ArtifactCard icon={<IconCode />} title={t('Code Changes')}>
      {summary}
    </ArtifactCard>
  );
}

interface PullRequestsPreviewProps {
  artifact: RepoPRState[];
}

export function PullRequestsPreview({artifact}: PullRequestsPreviewProps) {
  return (
    <ArtifactCard icon={<IconPullRequest />} title={t('Pull Requests')}>
      {artifact.map(pullRequest => {
        if (!pullRequest.repo_name || !pullRequest.pr_number || !pullRequest.pr_url) {
          return null;
        }
        const label = `${pullRequest.repo_name}#${pullRequest.pr_number}`;
        return (
          <ExternalLink key={label} href={pullRequest.pr_url}>
            {label}
          </ExternalLink>
        );
      })}
    </ArtifactCard>
  );
}

interface CodingAgentPreviewProps {
  artifact: ExplorerCodingAgentState[];
}

export function CodingAgentPreview({artifact}: CodingAgentPreviewProps) {
  const provider = artifact[0]?.provider;

  const title = useMemo(() => {
    switch (provider) {
      case CodingAgentProvider.CURSOR_BACKGROUND_AGENT:
        return t('Cursor Cloud Agent');
      case CodingAgentProvider.CLAUDE_CODE_AGENT:
        return t('Claude Agent');
      case CodingAgentProvider.GITHUB_COPILOT_AGENT:
        return t('GitHub Copilot');
      default:
        return t('Coding Agent');
    }
  }, [provider]);

  return (
    <ArtifactCard icon={<IconBot />} title={title}>
      {artifact.map(codingAgent => {
        const statusVariant =
          codingAgent.status === 'pending'
            ? ('muted' as const)
            : codingAgent.status === 'running'
              ? ('info' as const)
              : codingAgent.status === 'failed'
                ? ('danger' as const)
                : ('success' as const);

        return (
          <Flex key={codingAgent.id} direction="column" gap="md">
            <Text>{codingAgent.name}</Text>
            <Flex direction="row-reverse" align="center" justify="between">
              <Tag variant={statusVariant}>{codingAgent.status}</Tag>
              {codingAgent.agent_url ? (
                <LinkButton
                  priority="transparent"
                  size="xs"
                  icon={<IconOpen />}
                  href={codingAgent.agent_url}
                  external
                >
                  {t('Open in Agent')}
                </LinkButton>
              ) : null}
            </Flex>
          </Flex>
        );
      })}
    </ArtifactCard>
  );
}

interface ArtifactCardProps {
  children: ReactNode;
  icon: ReactNode;
  title: ReactNode;
}

function ArtifactCard({children, icon, title}: ArtifactCardProps) {
  return (
    <Flex direction="column" border="primary" radius="md" gap="md" padding="md">
      <Flex gap="md">
        {icon}
        <Text bold>{title}</Text>
      </Flex>
      {children}
    </Flex>
  );
}
