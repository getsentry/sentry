import {useMemo, type ReactNode} from 'react';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Markdown} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

import {getRepoPullRequestLink} from 'sentry/components/events/autofix/pullRequests';
import {
  collectPatches,
  getAutofixArtifactFromSection,
  getOrderedAutofixSections,
  isCodeChangesArtifact,
  isPullRequestsArtifact,
  isPullRequestsSection,
  isCodeChangesSection,
  isRootCauseArtifact,
  isSolutionArtifact,
  useExplorerAutofix,
  type AutofixExplorerStep,
  type AutofixSection,
  type RootCauseArtifact,
  type SolutionArtifact,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {ArtifactDetails} from 'sentry/components/events/autofix/v3/artifactDetails';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useAutofixChat} from 'sentry/components/seer/autofixChatContext';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {IconBug} from 'sentry/icons/iconBug';
import {IconCode} from 'sentry/icons/iconCode';
import {IconList} from 'sentry/icons/iconList';
import {IconOpen} from 'sentry/icons/iconOpen';
import {IconPullRequest} from 'sentry/icons/iconPullRequest';
import {t, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {MarkedText} from 'sentry/utils/marked/markedText';
import {useOrganization} from 'sentry/utils/useOrganization';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';

/**
 * The autofix API reports steps by identifier; only the UI spells them out.
 */
export const STEP_LABELS: Record<AutofixExplorerStep, string> = {
  root_cause: t('Root Cause'),
  solution: t('Plan'),
  code_changes: t('Code Changes'),
  pr_iteration: t('Pull Request'),
};

const STEP_ICONS: Record<AutofixExplorerStep, ReactNode> = {
  root_cause: <IconBug />,
  solution: <IconList />,
  code_changes: <IconCode />,
  pr_iteration: <IconPullRequest />,
};

interface AutofixDisclosureProps extends Pick<Group, 'id' | 'shortId'> {
  children: ReactNode;
  step: AutofixExplorerStep;
}

/**
 * The collapsible shell autofix embeds render into: an icon + step label title
 * with a link back to the issue, and arbitrary step content below.
 */
function AutofixDisclosure({id, shortId, step, children}: AutofixDisclosureProps) {
  const organization = useOrganization();
  return (
    <Disclosure>
      <Disclosure.Title
        trailingItems={
          <Link to={`/organizations/${organization.slug}/issues/${id}/`}>{shortId}</Link>
        }
      >
        <Flex gap="md">
          {STEP_ICONS[step]}
          <Text>{STEP_LABELS[step]}</Text>
        </Flex>
      </Disclosure.Title>
      <Disclosure.Content>{children}</Disclosure.Content>
    </Disclosure>
  );
}

interface AutofixContentProps extends Pick<Group, 'id' | 'shortId'> {
  /**
   * Markdown write-up for this step. Assembled by Seer rather than returned
   * verbatim by the autofix API, so it keeps a UI-facing name.
   */
  result: string;
  step: AutofixExplorerStep;
}

export const Autofix = defineSeerEmbed({
  name: 'autofix',
  render({id, shortId, result, step}: AutofixContentProps) {
    return (
      <AutofixDisclosure id={id} shortId={shortId} step={step}>
        <MarkedText text={result} />
      </AutofixDisclosure>
    );
  },
});

const PROCESSING_TEXT: Record<AutofixExplorerStep, string> = {
  root_cause: t('Finding the root cause…'),
  solution: t('Formulating a plan…'),
  code_changes: t('Implementing changes…'),
  pr_iteration: t('Opening a pull request…'),
};

const ERROR_TEXT: Record<AutofixExplorerStep, string> = {
  root_cause: t('Seer failed to generate a root cause. This one is on us.'),
  solution: t('Seer failed to generate a plan. This one is on us.'),
  code_changes: t('Seer failed to generate code changes. This one is on us.'),
  pr_iteration: t('Seer failed to open a pull request. This one is on us.'),
};

/**
 * The step to continue to once the given step completes. `code_changes` has no
 * entry — its completion offers "Draft a pull request" instead, a different
 * action. `pr_iteration` has no next step; it's the end of the line.
 */
export const NEXT_STEP: Partial<Record<AutofixExplorerStep, AutofixExplorerStep>> = {
  root_cause: 'solution',
  solution: 'code_changes',
};

interface AutofixRefContentProps extends Pick<Group, 'id' | 'shortId'> {
  runId: string | number;
  step: AutofixExplorerStep;
}

function AutofixRefContent({id, shortId, step}: AutofixRefContentProps) {
  const autofix = useExplorerAutofix({id, shortId});
  const {runState, isLoading, isPolling} = autofix;
  const {sendMessage} = useAutofixChat();

  const sections = useMemo(() => getOrderedAutofixSections(runState), [runState]);
  const section = useMemo(() => findStepSection(sections, step), [sections, step]);

  const handleRetry = () => {
    sendMessage?.(t('Retry the %s step for %s.', STEP_LABELS[step], shortId));
  };

  const handleContinue = (nextStep: AutofixExplorerStep) => {
    sendMessage?.(t('Continue to the %s step for %s.', STEP_LABELS[nextStep], shortId));
  };

  const handleCreatePR = () => {
    sendMessage?.(t('Draft a pull request for %s.', shortId));
  };

  const nextStep = NEXT_STEP[step];
  const canAct = !!sendMessage && !isPolling;

  return (
    <AutofixDisclosure id={id} shortId={shortId} step={step}>
      <Stack gap="lg">
        <AutofixRefBody isLoading={isLoading} section={section} step={step} />
        {section?.status === 'error' && (
          <Flex>
            <Button size="sm" onClick={handleRetry} disabled={!canAct}>
              {t('Try again')}
            </Button>
          </Flex>
        )}
        {section?.status === 'completed' && (
          <Flex gap="sm">
            {step === 'code_changes' && (
              <Button
                size="sm"
                variant="primary"
                onClick={handleCreatePR}
                disabled={!canAct}
              >
                {t('Draft a pull request')}
              </Button>
            )}
            {nextStep && (
              <Button
                size="sm"
                variant="primary"
                onClick={() => handleContinue(nextStep)}
                disabled={!canAct}
              >
                {t('Continue: %s', STEP_LABELS[nextStep])}
              </Button>
            )}
          </Flex>
        )}
      </Stack>
    </AutofixDisclosure>
  );
}

interface AutofixRefBodyProps {
  isLoading: boolean;
  step: AutofixExplorerStep;
  section?: AutofixSection;
}

function AutofixRefBody({isLoading, section, step}: AutofixRefBodyProps) {
  if (isLoading || !section || section.status === 'processing') {
    return (
      <Flex gap="md" align="center">
        <LoadingIndicator size={16} style={{margin: 0}} />
        <Text variant="muted">{PROCESSING_TEXT[step]}</Text>
      </Flex>
    );
  }

  if (section.status === 'error') {
    return <Text variant="danger">{ERROR_TEXT[step]}</Text>;
  }

  if (isPullRequestsSection(section)) {
    const artifact = getAutofixArtifactFromSection(section);
    const pullRequests = isPullRequestsArtifact(artifact) ? artifact : [];
    const links = pullRequests.map(getRepoPullRequestLink).filter(link => link !== null);

    if (!links.length) {
      return <Text variant="muted">{ERROR_TEXT.pr_iteration}</Text>;
    }

    return (
      <Flex gap="sm" wrap="wrap">
        {links.map(link => (
          <LinkButton
            key={link.url}
            size="sm"
            icon={<IconOpen />}
            href={link.url}
            external
          >
            {link.label}
          </LinkButton>
        ))}
      </Flex>
    );
  }

  const artifact = getAutofixArtifactFromSection(section);

  if (step === 'root_cause' && isRootCauseArtifact(artifact)) {
    return <RootCauseBody data={artifact.data} />;
  }

  if (step === 'solution' && isSolutionArtifact(artifact)) {
    return <SolutionBody data={artifact.data} />;
  }

  if (isCodeChangesArtifact(artifact)) {
    const patchesByRepo = collectPatches(artifact);
    if (patchesByRepo.size > 0) {
      return <CodeChangesBody patchesByRepo={patchesByRepo} />;
    }
  }

  return <Text variant="muted">{ERROR_TEXT[step]}</Text>;
}

interface RootCauseBodyProps {
  data: RootCauseArtifact | null;
}

function RootCauseBody({data}: RootCauseBodyProps) {
  if (!data) {
    return <Markdown raw="" />;
  }

  return (
    <Stack gap="lg">
      <Markdown raw={data.one_line_description} />
      {data.five_whys.length > 0 && (
        <ArtifactDetails>
          <Text bold>{t('Why did this happen?')}</Text>
          <Container as="ul" margin="0">
            {data.five_whys.map((why, index) => (
              <li key={index}>
                <Markdown raw={why} />
              </li>
            ))}
          </Container>
        </ArtifactDetails>
      )}
      {data.reproduction_steps && data.reproduction_steps.length > 0 && (
        <ArtifactDetails>
          <Text bold>{t('Reproduction Steps')}</Text>
          <Container as="ol" margin="0">
            {data.reproduction_steps.map((step, index) => (
              <li key={index}>
                <Markdown raw={step} />
              </li>
            ))}
          </Container>
        </ArtifactDetails>
      )}
    </Stack>
  );
}

interface SolutionBodyProps {
  data: SolutionArtifact | null;
}

function SolutionBody({data}: SolutionBodyProps) {
  if (!data) {
    return <Markdown raw="" />;
  }

  return (
    <Stack gap="lg">
      <Markdown raw={data.one_line_summary} />
      {data.steps.length > 0 && (
        <ArtifactDetails>
          <Text bold>{t('Steps to Resolve')}</Text>
          <Container as="ol" margin="0">
            {data.steps.map((step, index) => (
              <li key={index}>
                <Stack>
                  <Markdown raw={step.title} />
                  <Text size="sm" variant="muted">
                    {step.description}
                  </Text>
                </Stack>
              </li>
            ))}
          </Container>
        </ArtifactDetails>
      )}
    </Stack>
  );
}

interface CodeChangesBodyProps {
  patchesByRepo: ReturnType<typeof collectPatches>;
}

function CodeChangesBody({patchesByRepo}: CodeChangesBodyProps) {
  return (
    <Stack gap="lg">
      <Text>{summarizeCodeChanges(patchesByRepo)}</Text>
      {Array.from(patchesByRepo.entries(), ([repo, repoPatches]) => (
        <ArtifactDetails key={repo}>
          <Flex gap="lg">
            <Text bold>{t('Repository:')}</Text>
            <Text>{repo}</Text>
          </Flex>
          {repoPatches.map((patch, index) => (
            <FileDiffViewer
              key={index}
              patch={patch.patch}
              showBorder
              collapsible
              defaultExpanded={repoPatches.length <= 1}
            />
          ))}
        </ArtifactDetails>
      ))}
    </Stack>
  );
}

function findStepSection(
  sections: AutofixSection[],
  step: AutofixExplorerStep
): AutofixSection | undefined {
  if (step === 'pr_iteration') {
    return sections.find(isPullRequestsSection) ?? sections.find(isCodeChangesSection);
  }
  return sections.find(s => s.step === step);
}

function summarizeCodeChanges(patchesByRepo: ReturnType<typeof collectPatches>): string {
  const filesChanged = new Set<string>();
  for (const [repoName, patches] of patchesByRepo) {
    for (const patch of patches) {
      filesChanged.add(`${repoName}:${patch.patch.path}`);
    }
  }

  if (patchesByRepo.size === 1) {
    return tn(
      '%s file changed in 1 repo',
      '%s files changed in 1 repo',
      filesChanged.size
    );
  }
  return t('%s files changed in %s repos', filesChanged.size, patchesByRepo.size);
}

export const AutofixRef = defineSeerEmbed({
  name: 'autofixRef',
  render(props) {
    return <AutofixRefContent {...props} />;
  },
});
