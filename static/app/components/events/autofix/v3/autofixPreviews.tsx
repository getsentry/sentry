import {useMemo, type ReactNode} from 'react';

import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {
  CodingAgentStatus,
  getCodingAgentName,
} from 'sentry/components/events/autofix/types';
import {
  collectPatches,
  getAutofixArtifactFromSection,
  isCodeChangesArtifact,
  isCodingAgentsArtifact,
  isPullRequestsArtifact,
  isRootCauseArtifact,
  isSolutionArtifact,
  type AutofixSection,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {Placeholder} from 'sentry/components/placeholder';
import {IconOpen} from 'sentry/icons';
import {IconBot} from 'sentry/icons/iconBot';
import {IconBug} from 'sentry/icons/iconBug';
import {IconCode} from 'sentry/icons/iconCode';
import {IconList} from 'sentry/icons/iconList';
import {IconPullRequest} from 'sentry/icons/iconPullRequest';
import {t, tn} from 'sentry/locale';

interface ArtifactPreviewProps {
  section: AutofixSection;
}

export function RootCausePreview({section}: ArtifactPreviewProps) {
  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isRootCauseArtifact(sectionArtifact) ? sectionArtifact : null;
  }, [section]);

  return (
    <ArtifactCard icon={<IconBug />} title={t('Root Cause')}>
      {section.status === 'processing' ? (
        <Placeholder height="3rem" />
      ) : artifact?.data ? (
        <Text>{artifact.data.one_line_description}</Text>
      ) : (
        <Text variant="muted">
          {t(
            'Seer failed to generate a root cause. This one is on us. Try running it again.'
          )}
        </Text>
      )}
    </ArtifactCard>
  );
}

export function SolutionPreview({section}: ArtifactPreviewProps) {
  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isSolutionArtifact(sectionArtifact) ? sectionArtifact : null;
  }, [section]);

  return (
    <ArtifactCard icon={<IconList />} title={t('Plan')}>
      {section.status === 'processing' ? (
        <Placeholder height="3rem" />
      ) : artifact?.data ? (
        <Text>{artifact.data.one_line_summary}</Text>
      ) : (
        <Text variant="muted">
          {t('Seer failed to generate a plan. This one is on us. Try running it again.')}
        </Text>
      )}
    </ArtifactCard>
  );
}

export function CodeChangesPreview({section}: ArtifactPreviewProps) {
  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isCodeChangesArtifact(sectionArtifact) ? sectionArtifact : [];
  }, [section]);

  const patchesByRepo = useMemo(() => collectPatches(artifact ?? []), [artifact]);

  const summary = useMemo(() => {
    const reposChanged = patchesByRepo.size;

    const filesChanged = new Set<string>();

    for (const [repo, patchesForRepo] of patchesByRepo.entries()) {
      for (const patch of patchesForRepo) {
        filesChanged.add(`${repo}:${patch.patch.path}`);
      }
    }

    if (reposChanged === 0) {
      return (
        <Text variant="muted">
          {t(
            'Seer failed to generate a code change. This one is on us. Try running it again.'
          )}
        </Text>
      );
    }

    if (reposChanged === 1) {
      return (
        <Text>
          {tn(
            '%s file changed in 1 repo',
            '%s files changed in 1 repo',
            filesChanged.size
          )}
        </Text>
      );
    }

    return (
      <Text>{t('%s files changed in %s repos', filesChanged.size, reposChanged)}</Text>
    );
  }, [patchesByRepo]);

  return (
    <ArtifactCard icon={<IconCode />} title={t('Code Changes')}>
      {section.status === 'processing' ? <Placeholder height="1.5rem" /> : summary}
    </ArtifactCard>
  );
}

export function PullRequestsPreview({section}: ArtifactPreviewProps) {
  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isPullRequestsArtifact(sectionArtifact) ? sectionArtifact : [];
  }, [section]);

  return (
    <ArtifactCard icon={<IconPullRequest />} title={t('Pull Requests')}>
      {artifact.map(pullRequest => {
        if (pullRequest.pr_creation_status === 'creating') {
          return <Placeholder key={pullRequest.repo_name} height="1.5rem" />;
        }

        if (
          pullRequest.pr_creation_status === 'completed' &&
          pullRequest.pr_url &&
          pullRequest.pr_number
        ) {
          return (
            <ExternalLink key={pullRequest.repo_name} href={pullRequest.pr_url}>
              {pullRequest.repo_name}#{pullRequest.pr_number}
            </ExternalLink>
          );
        }

        return (
          <ExternalLink key={pullRequest.repo_name} disabled>
            {t('Failed to create PR in %s', pullRequest.repo_name)}
          </ExternalLink>
        );
      })}
    </ArtifactCard>
  );
}

export function CodingAgentPreview({section}: ArtifactPreviewProps) {
  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isCodingAgentsArtifact(sectionArtifact) ? sectionArtifact : [];
  }, [section]);

  const provider = artifact[0]?.provider;

  const agentName = useMemo(() => getCodingAgentName(provider), [provider]);

  return (
    <ArtifactCard icon={<IconBot />} title={agentName}>
      {artifact.map(codingAgent => {
        const statusVariant =
          codingAgent.status === CodingAgentStatus.PENDING
            ? ('muted' as const)
            : codingAgent.status === CodingAgentStatus.RUNNING
              ? ('info' as const)
              : codingAgent.status === CodingAgentStatus.FAILED
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
