import {Fragment, useEffect, useMemo, useRef, type ReactNode} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button, LinkButton} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, type FlexProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  CodingAgentStatus,
  getCodingAgentName,
  getResultButtonLabel,
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
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {TimeSince} from 'sentry/components/timeSince';
import {IconCopy, IconRefresh} from 'sentry/icons';
import {IconBot} from 'sentry/icons/iconBot';
import {IconBug} from 'sentry/icons/iconBug';
import {IconCode} from 'sentry/icons/iconCode';
import {IconList} from 'sentry/icons/iconList';
import {IconOpen} from 'sentry/icons/iconOpen';
import {IconPullRequest} from 'sentry/icons/iconPullRequest';
import {t, tct, tn} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {FileDiffViewer} from 'sentry/views/seerExplorer/fileDiffViewer';

interface AutofixCardProps {
  autofix: ReturnType<typeof useExplorerAutofix>;
  section: AutofixSection;
}

export function RootCauseCard({autofix, section}: AutofixCardProps) {
  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isRootCauseArtifact(sectionArtifact) ? sectionArtifact : null;
  }, [section]);

  const {startStep} = autofix;

  return (
    <ArtifactCard icon={<IconBug />} title={t('Root Cause')}>
      {section.status === 'processing' ? (
        <LoadingDetails
          messages={section.messages}
          loadingMessage={t('Finding the root cause\u2026')}
        />
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
              onClick={() => startStep('root_cause')}
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
  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isSolutionArtifact(sectionArtifact) ? sectionArtifact : null;
  }, [section]);

  const {runState, startStep} = autofix;
  const runId = runState?.run_id;

  return (
    <ArtifactCard icon={<IconList />} title={t('Plan')}>
      {section.status === 'processing' ? (
        <LoadingDetails
          messages={section.messages}
          loadingMessage={t('Formulating a plan\u2026')}
        />
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
              'Seer failed to generate a plan. This one is on us. Try running it again.'
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
  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isCodeChangesArtifact(sectionArtifact) ? sectionArtifact : null;
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

    if (reposChanged === 1) {
      return tn(
        '%s file changed in 1 repo',
        '%s files changed in 1 repo',
        filesChanged.size
      );
    }

    return t('%s files changed in %s repos', filesChanged.size, reposChanged);
  }, [patchesByRepo]);

  const {runState, startStep} = autofix;
  const runId = runState?.run_id;

  return (
    <ArtifactCard icon={<IconCode />} title={t('Code Changes')}>
      {section.status === 'processing' ? (
        <LoadingDetails
          messages={section.messages}
          loadingMessage={t('Implementing changes\u2026')}
        />
      ) : (
        <Fragment>
          {patchesByRepo.size ? (
            <Fragment>
              <Text>{summary}</Text>
              {[...patchesByRepo.entries()].map(([repo, patches]) => (
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
                      defaultExpanded={artifact !== null && artifact.length <= 1}
                    />
                  ))}
                </ArtifactDetails>
              ))}
            </Fragment>
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
  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isPullRequestsArtifact(sectionArtifact) ? sectionArtifact : null;
  }, [section]);
  const {copy} = useCopyToClipboard();

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
            <Flex key={pullRequest.repo_name} gap="xs" align="center">
              <LinkButton external href={pullRequest.pr_url} priority="primary">
                {t('View %s#%s', pullRequest.repo_name, pullRequest.pr_number)}
              </LinkButton>
              <Button
                priority="primary"
                icon={<IconCopy size="xs" />}
                aria-label={t('Copy PR URL')}
                tooltipProps={{title: t('Copy PR URL')}}
                onClick={() =>
                  copy(pullRequest.pr_url!, {
                    successMessage: t('PR URL copied to clipboard.'),
                  })
                }
              />
            </Flex>
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

export function CodingAgentCard({section}: AutofixCardProps) {
  const artifact = useMemo(() => {
    const sectionArtifact = getAutofixArtifactFromSection(section);
    return isCodingAgentsArtifact(sectionArtifact) ? sectionArtifact : null;
  }, [section]);

  const provider = artifact?.[0]?.provider;

  const agentName = useMemo(() => getCodingAgentName(provider), [provider]);

  return (
    <ArtifactCard icon={<IconBot />} title={agentName}>
      {artifact?.map(codingAgent => {
        const statusVariant =
          codingAgent.status === CodingAgentStatus.PENDING
            ? ('muted' as const)
            : codingAgent.status === CodingAgentStatus.RUNNING
              ? ('info' as const)
              : codingAgent.status === CodingAgentStatus.FAILED
                ? ('danger' as const)
                : ('success' as const);

        return (
          <ArtifactDetails key={codingAgent.id} direction="column" gap="md">
            <Flex direction="row" justify="between">
              <Flex direction="row" gap="md">
                <Text>{codingAgent.name}</Text>
                <Text variant="muted">
                  {tct('Started [startedAt]', {
                    startedAt: <TimeSince date={codingAgent.started_at} />,
                  })}
                </Text>
              </Flex>
              <Tag variant={statusVariant}>{codingAgent.status}</Tag>
            </Flex>
            <Flex direction="row" gap="md">
              {codingAgent.agent_url ? (
                <LinkButton href={codingAgent.agent_url} external icon={<IconOpen />}>
                  {t('Open in %s', agentName)}
                </LinkButton>
              ) : null}
              {codingAgent.results?.map(result => {
                if (!result.pr_url) {
                  return null;
                }

                return (
                  <LinkButton
                    key={result.pr_url}
                    href={result.pr_url}
                    external
                    icon={<IconOpen />}
                  >
                    {getResultButtonLabel(result.pr_url)}
                  </LinkButton>
                );
              })}
            </Flex>
          </ArtifactDetails>
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
    <Container border="primary" radius="md" padding="lg" background="primary">
      <Disclosure defaultExpanded>
        <Disclosure.Title>
          <Flex gap="md" align="center">
            {icon}
            <Text bold>{title}</Text>
          </Flex>
        </Disclosure.Title>
        <Disclosure.Content>
          <Flex direction="column" gap="lg">
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
    <Flex direction="column" borderTop="primary" gap="md" paddingTop="lg" {...flexProps}>
      {children}
    </Flex>
  );
}

interface LoadingDetailsProps {
  loadingMessage: string;
  messages: AutofixSection['messages'];
}

function LoadingDetails({loadingMessage, messages}: LoadingDetailsProps) {
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
        <Flex ref={bottomRef} direction="row" gap="md">
          <StyledLoadingIndicator size={16} />
          <Text variant="muted">{loadingMessage}</Text>
        </Flex>
      </Flex>
    </ArtifactDetails>
  );
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;
