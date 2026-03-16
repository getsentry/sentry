import {Fragment, useEffect, useMemo, useRef, type ReactNode} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, type FlexProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  isCodeChangesArtifact,
  isPullRequestArtifact,
  isRootCauseArtifact,
  isSolutionArtifact,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import Placeholder from 'sentry/components/placeholder';
import {IconRefresh} from 'sentry/icons';
import {IconBug} from 'sentry/icons/iconBug';
import {IconCode} from 'sentry/icons/iconCode';
import {IconList} from 'sentry/icons/iconList';
import {IconPullRequest} from 'sentry/icons/iconPullRequest';
import {t, tn} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {FileDiffViewer} from 'sentry/views/seerExplorer/fileDiffViewer';
import {type ExplorerFilePatch} from 'sentry/views/seerExplorer/types';

interface AutofixCardProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  section: AutofixSection;
}

export function RootCauseCard({autofix, section}: AutofixCardProps) {
  const artifact = useMemo(
    () => section.artifacts.findLast(isRootCauseArtifact),
    [section.artifacts]
  );

  const {runState, startStep} = autofix;
  const runId = runState?.run_id;

  return (
    <ArtifactCard icon={<IconBug />} title={t('Root Cause')}>
      {section.status === 'processing' ? (
        <LoadingDetails messages={section.messages} />
      ) : artifact?.data ? (
        <Fragment>
          <Text>{artifact.data.one_line_description}</Text>
          {artifact.data.five_whys?.length ? (
            <Fragment>
              <ArtifactDetails>
                <Text bold>{t('Why did this happen?')}</Text>
                <Container as="ul" margin="0">
                  {artifact.data.five_whys.map((why, index) => (
                    <li key={index}>
                      <Text>{why}</Text>
                    </li>
                  ))}
                </Container>
              </ArtifactDetails>
              {artifact.data.reproduction_steps?.length ? (
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
          ) : null}
        </Fragment>
      ) : (
        <ArtifactDetails>
          <Text>
            {t(
              'Seer failed to generate a root cause. This one is on us. Try running it again.'
            )}
          </Text>
          <div>
            <Button
              priority="primary"
              icon={<IconRefresh />}
              onClick={() => startStep('root_cause', runId)}
            >
              {t('Re-run')}
            </Button>
          </div>
        </ArtifactDetails>
      )}
    </ArtifactCard>
  );
}

export function SolutionCard({autofix, section}: AutofixCardProps) {
  const artifact = useMemo(
    () => section.artifacts.findLast(isSolutionArtifact),
    [section.artifacts]
  );

  const {runState, startStep} = autofix;
  const runId = runState?.run_id;

  return (
    <ArtifactCard icon={<IconList />} title={t('Implementation Plan')}>
      {section.status === 'processing' ? (
        <LoadingDetails messages={section.messages} />
      ) : artifact?.data ? (
        <Fragment>
          <Text>{artifact.data.one_line_summary}</Text>
          {artifact.data.steps ? (
            <ArtifactDetails>
              <Text bold>{t('Steps to Resolve')}</Text>
              <Container as="ol" margin="0">
                {artifact.data.steps.map((step, index) => (
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
          ) : null}
        </Fragment>
      ) : (
        <ArtifactDetails>
          <Text>
            {t(
              'Seer failed to generate an implementation plan. This one is on us. Try running it again.'
            )}
          </Text>
          <div>
            <Button
              priority="primary"
              icon={<IconRefresh />}
              onClick={() => startStep('solution', runId)}
            >
              {t('Re-run')}
            </Button>
          </div>
        </ArtifactDetails>
      )}
    </ArtifactCard>
  );
}

export function CodeChangesCard({autofix, section}: AutofixCardProps) {
  const artifact = useMemo(
    () => section.artifacts.findLast(isCodeChangesArtifact),
    [section.artifacts]
  );

  const patchesForRepos = useMemo(() => {
    const patchesByRepo = new Map<string, ExplorerFilePatch[]>();
    for (const patch of artifact ?? []) {
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

  const {runState, startStep} = autofix;
  const runId = runState?.run_id;

  return (
    <ArtifactCard icon={<IconCode />} title={t('Code Changes')}>
      {section.status === 'processing' ? (
        <LoadingDetails messages={section.messages} />
      ) : (
        <Fragment>
          <Text>{summary}</Text>
          {patchesForRepos.size ? (
            [...patchesForRepos.entries()].map(([repo, patches]) => (
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
                    defaultExpanded={artifact && artifact.length <= 1}
                  />
                ))}
              </ArtifactDetails>
            ))
          ) : (
            <ArtifactDetails>
              <Text>
                {t(
                  'Seer failed to generate a code change. This one is on us. Try running it again.'
                )}
              </Text>
              <div>
                <Button
                  priority="primary"
                  icon={<IconRefresh />}
                  onClick={() => startStep('code_changes', runId)}
                >
                  {t('Re-run')}
                </Button>
              </div>
            </ArtifactDetails>
          )}
        </Fragment>
      )}
    </ArtifactCard>
  );
}

export function PullRequestsCard({section}: AutofixCardProps) {
  const artifact = useMemo(
    () => section.artifacts.findLast(isPullRequestArtifact),
    [section.artifacts]
  );

  return (
    <ArtifactCard icon={<IconPullRequest />} title={t('Pull Requests')}>
      {artifact?.map(pullRequest => {
        if (pullRequest.pr_creation_status === 'creating') {
          return (
            <Button key={pullRequest.repo_name} priority="primary" disabled>
              {t('Creating PR in %s', pullRequest.repo_name)}
            </Button>
          );
        }

        if (
          pullRequest.pr_creation_status === 'completed' &&
          pullRequest.pr_url &&
          pullRequest.pr_number
        ) {
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
        }

        return (
          <Button key={pullRequest.repo_name} priority="primary" disabled>
            {t('Failed to create PR in %s', pullRequest.repo_name)}
          </Button>
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
    <Container border="primary" radius="md" padding="md" background="primary">
      <Disclosure defaultExpanded>
        <Disclosure.Title>
          <Flex gap="md" align="center">
            {icon}
            <Text bold>{title}</Text>
          </Flex>
        </Disclosure.Title>
        <Disclosure.Content>
          <Flex direction="column" gap="md">
            {children}
          </Flex>
        </Disclosure.Content>
      </Disclosure>
    </Container>
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

interface LoadingDetailsProps {
  messages: AutofixSection['messages'];
}

function LoadingDetails({messages}: LoadingDetailsProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    const bottom = bottomRef.current;
    if (!defined(container) || !defined(bottom)) {
      return;
    }

    if (container.scrollHeight <= container.clientHeight) {
      return;
    }

    bottomRef.current?.scrollIntoView({behavior: 'smooth', block: 'end'});
  }, [messages]);

  return (
    <ArtifactDetails paddingTop="0">
      <Flex
        direction="column"
        gap="md"
        marginTop="md"
        ref={containerRef}
        maxHeight="200px"
        overflowY="scroll"
      >
        {messages.map((message, index) => {
          if (message.role === 'user') {
            // The user role is used to pass the prompts
            return null;
          }

          if (message.content && message.content !== 'Thinking...') {
            return (
              <Text key={index} variant="muted">
                {message.content}
              </Text>
            );
          }

          return null;
        })}
        <div ref={bottomRef}>
          <Placeholder height="1.5rem" />
        </div>
      </Flex>
    </ArtifactDetails>
  );
}
