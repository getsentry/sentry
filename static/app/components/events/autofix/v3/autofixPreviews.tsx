import {useMemo, type ReactNode} from 'react';

import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import type {
  RootCauseArtifact,
  SolutionArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {IconBug} from 'sentry/icons/iconBug';
import {IconCode} from 'sentry/icons/iconCode';
import {IconList} from 'sentry/icons/iconList';
import {IconPullRequest} from 'sentry/icons/iconPullRequest';
import {t, tn} from 'sentry/locale';
import {
  type Artifact,
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

  const reposChanged = patchesForRepos.size;

  const filesChanged = useMemo(() => {
    const changed = new Set<string>();

    for (const [repo, patchesForRepo] of patchesForRepos.entries()) {
      for (const patch of patchesForRepo) {
        changed.add(`${repo}:${patch.patch.path}`);
      }
    }

    return changed.size;
  }, [patchesForRepos]);

  return (
    <ArtifactCard icon={<IconCode />} title={t('Code Changes')}>
      {reposChanged === 1
        ? tn('%s file changed in 1 repo', '%s files changed in 1 repo', filesChanged)
        : reposChanged > 1
          ? t('%s files changed in %s repos', filesChanged, reposChanged)
          : null}
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
