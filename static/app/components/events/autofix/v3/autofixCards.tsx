import {Fragment, useMemo, useState, type ReactNode} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Grid, type FlexProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {
  RootCauseArtifact,
  SolutionArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import Placeholder from 'sentry/components/placeholder';
import {IconChevron} from 'sentry/icons';
import {IconBug} from 'sentry/icons/iconBug';
import {IconCode} from 'sentry/icons/iconCode';
import {IconList} from 'sentry/icons/iconList';
import {IconPullRequest} from 'sentry/icons/iconPullRequest';
import {t, tn} from 'sentry/locale';
import {FileDiffViewer} from 'sentry/views/seerExplorer/fileDiffViewer';
import {
  type Artifact,
  type ExplorerFilePatch,
  type RepoPRState,
} from 'sentry/views/seerExplorer/types';

interface RootCauseCardProps {
  artifact: Artifact<RootCauseArtifact>;
}

export function RootCauseCard({artifact}: RootCauseCardProps) {
  return (
    <ArtifactCard
      icon={<IconBug />}
      title={t('Root Cause')}
      summary={artifact.data?.one_line_description}
    >
      {artifact.data?.five_whys?.length ? (
        <Fragment>
          <ArtifactDetails>
            <Text bold>{t('Why did this happen?')}</Text>
            <Container as="ul" margin="0">
              {artifact.data?.five_whys.map((why, index) => (
                <li key={index}>
                  <Text>{why}</Text>
                </li>
              ))}
            </Container>
          </ArtifactDetails>
          {artifact.data?.reproduction_steps?.length ? (
            <ArtifactDetails>
              <Text bold>{t('Reproduction Steps')}</Text>
              <Container as="ol" margin="0">
                {artifact.data?.reproduction_steps.map((step, index) => (
                  <li key={index}>
                    <Text>{step}</Text>
                  </li>
                ))}
              </Container>
            </ArtifactDetails>
          ) : null}
        </Fragment>
      ) : (
        <Placeholder height="3rem" />
      )}
    </ArtifactCard>
  );
}

interface SolutionCardProps {
  artifact: Artifact<SolutionArtifact>;
}

export function SolutionCard({artifact}: SolutionCardProps) {
  return (
    <ArtifactCard
      icon={<IconList />}
      title={t('Implementation Plan')}
      summary={artifact?.data?.one_line_summary}
    >
      {artifact.data?.steps ? (
        <ArtifactDetails>
          <Text bold>{t('Steps to Resolve')}</Text>
          <Container as="ol" margin="0">
            {artifact.data?.steps.map((step, index) => (
              <li key={index}>
                <Flex direction="column">
                  <Text>{step.title}</Text>
                  <Text size="sm" variant="muted">
                    {step.description}
                  </Text>
                </Flex>
              </li>
            ))}
          </Container>
        </ArtifactDetails>
      ) : (
        <Placeholder height="3rem" />
      )}
    </ArtifactCard>
  );
}

interface CodeChangesCardProps {
  artifact: ExplorerFilePatch[];
}

export function CodeChangesCard({artifact}: CodeChangesCardProps) {
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
    <ArtifactCard icon={<IconCode />} title={t('Code Changes')} summary={summary}>
      {patchesForRepos.size ? (
        [...patchesForRepos.entries()].map(([repo, patches]) => {
          return (
            <ArtifactDetails key={repo}>
              <Flex gap="lg">
                <Text bold>{t('Repository:')}</Text>
                <Text>{repo}</Text>
              </Flex>
              {patches.map((patch, index) => (
                <FileDiffViewer
                  key={index}
                  patch={patch.patch}
                  showBorder
                  collapsible
                  defaultExpanded={artifact.length <= 1}
                />
              ))}
            </ArtifactDetails>
          );
        })
      ) : (
        <Placeholder height="3rem" />
      )}
    </ArtifactCard>
  );
}

interface PullRequestsCardProps {
  artifact: RepoPRState[];
}

export function PullRequestsCard({artifact}: PullRequestsCardProps) {
  return (
    <ArtifactCard icon={<IconPullRequest />} title={t('Pull Requests')} summary={null}>
      {artifact.map(pullRequest => {
        if (!pullRequest.pr_url || !pullRequest.pr_number) {
          return null;
        }

        return (
          <LinkButton
            key={pullRequest.repo_name}
            external
            href={pullRequest.pr_url}
            priority="primary"
          >
            {t('View PR#%s in %s', pullRequest.pr_number, pullRequest.repo_name)}
          </LinkButton>
        );
      })}
    </ArtifactCard>
  );
}

interface ArtifactCardProps {
  children: ReactNode;
  icon: ReactNode;
  summary: ReactNode;
  title: ReactNode;
}

function ArtifactCard({children, icon, summary, title}: ArtifactCardProps) {
  const [expanded, setExpanded] = useState(true);
  return (
    <Grid
      areas={`"chevron header padding" "empty main padding"`}
      columns="28px auto 28px"
      rows="28px auto"
      border="primary"
      radius="md"
      gap="md"
      padding="md"
      paddingBottom="xl"
      background="primary"
    >
      <Flex area="chevron" gap="md" align="center">
        <Button
          size="xs"
          icon={<IconChevron direction={expanded ? 'down' : 'right'} />}
          onClick={() => setExpanded((isExpanded: boolean) => !isExpanded)}
          tooltipProps={{title: expanded ? t('Collapse') : t('Expand')}}
          aria-label={expanded ? t('Collapse') : t('Expand')}
          priority="transparent"
        />
      </Flex>
      <Flex area="header" gap="md" align="center">
        {icon}
        <Text bold>{title}</Text>
      </Flex>
      <Flex area="main" direction="column" gap="md">
        <Text>{summary}</Text>
        {expanded && children}
      </Flex>
    </Grid>
  );
}

interface ArtifactDetailsProps extends FlexProps {
  children: ReactNode;
}

function ArtifactDetails({children, ...flexProps}: ArtifactDetailsProps) {
  return (
    <Flex direction="column" borderTop="primary" gap="md" paddingTop="md" {...flexProps}>
      {children}
    </Flex>
  );
}
