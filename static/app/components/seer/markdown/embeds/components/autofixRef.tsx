import {useMemo, type ReactNode} from 'react';

import {Button} from '@sentry/scraps/button';
import {Disclosure} from '@sentry/scraps/disclosure';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Markdown} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

import {getAutofixRunId} from 'sentry/components/events/autofix/autofixRunId';
import {getRepoPullRequestLink} from 'sentry/components/events/autofix/pullRequests';
import {
  collectPatches,
  getAutofixArtifactFromSection,
  getOrderedAutofixSections,
  isCodeChangesArtifact,
  isPullRequestsArtifact,
  isPullRequestsSection,
  isRootCauseArtifact,
  isSolutionArtifact,
  useExplorerAutofix,
  type AutofixExplorerStep,
  type AutofixSection,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {defineSeerEmbed} from 'sentry/components/seer/markdown/embeds/utils';
import {IconBug} from 'sentry/icons/iconBug';
import {IconCode} from 'sentry/icons/iconCode';
import {IconList} from 'sentry/icons/iconList';
import {IconPullRequest} from 'sentry/icons/iconPullRequest';
import {t, tn} from 'sentry/locale';
import type {Group} from 'sentry/types/group';
import {useOrganization} from 'sentry/utils/useOrganization';

/**
 * The autofix API reports steps by identifier; only the UI spells them out.
 */
const STEP_LABELS: Record<AutofixExplorerStep, string> = {
  root_cause: t('Root Cause'),
  solution: t('Solution'),
  code_changes: t('Code Changes'),
  pr_iteration: t('Pull Request'),
};

const STEP_ICONS: Record<AutofixExplorerStep, ReactNode> = {
  root_cause: <IconBug />,
  solution: <IconList />,
  code_changes: <IconCode />,
  pr_iteration: <IconPullRequest />,
};

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
 * action (createPR) rather than another startStep call. `pr_iteration` has no
 * next step; it's the end of the line.
 */
const NEXT_STEP: Partial<Record<AutofixExplorerStep, AutofixExplorerStep>> = {
  root_cause: 'solution',
  solution: 'code_changes',
};

interface AutofixRefContentProps extends Pick<Group, 'id' | 'shortId'> {
  runId: string | number;
  step: AutofixExplorerStep;
}

function AutofixRefContent({id, shortId, runId, step}: AutofixRefContentProps) {
  const organization = useOrganization();
  const autofix = useExplorerAutofix({id, shortId});
  const {runState, isLoading, isPolling, startStep, createPR} = autofix;

  const sections = useMemo(() => getOrderedAutofixSections(runState), [runState]);
  const section = useMemo(() => findStepSection(sections, step), [sections, step]);

  const activeRunId = getAutofixRunId(runState) ?? runId;

  function handleRetry() {
    startStep(step, {runId: activeRunId, insertIndex: section?.index});
  }

  function handleContinue(nextStep: AutofixExplorerStep) {
    startStep(nextStep, {runId: activeRunId});
  }

  function handleCreatePR() {
    createPR(activeRunId);
  }

  const nextStep = NEXT_STEP[step];

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
      <Disclosure.Content>
        <Stack gap="lg">
          <AutofixRefBody isLoading={isLoading} section={section} step={step} />
          {section?.status === 'error' && (
            <Flex>
              <Button size="sm" onClick={handleRetry} disabled={isPolling}>
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
                  disabled={isPolling}
                >
                  {t('Draft a pull request')}
                </Button>
              )}
              {nextStep && (
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => handleContinue(nextStep)}
                  disabled={isPolling}
                >
                  {t('Continue: %s', STEP_LABELS[nextStep])}
                </Button>
              )}
            </Flex>
          )}
        </Stack>
      </Disclosure.Content>
    </Disclosure>
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
      <Stack gap="xs">
        {links.map(link => (
          <Link key={link.url} to={link.url}>
            {link.label}
          </Link>
        ))}
      </Stack>
    );
  }

  const artifact = getAutofixArtifactFromSection(section);

  if (step === 'root_cause' && isRootCauseArtifact(artifact)) {
    return <Markdown raw={artifact.data?.one_line_description ?? ''} />;
  }

  if (step === 'solution' && isSolutionArtifact(artifact)) {
    return <Markdown raw={artifact.data?.one_line_summary ?? ''} />;
  }

  if (isCodeChangesArtifact(artifact)) {
    const summary = summarizeCodeChanges(artifact);
    if (summary) {
      return <Text>{summary}</Text>;
    }
  }

  return <Text variant="muted">{ERROR_TEXT[step]}</Text>;
}

function findStepSection(
  sections: AutofixSection[],
  step: AutofixExplorerStep
): AutofixSection | undefined {
  if (step === 'pr_iteration') {
    return (
      sections.find(isPullRequestsSection) ??
      sections.find(s => s.step === 'code_changes')
    );
  }
  return sections.find(s => s.step === step);
}

function summarizeCodeChanges(
  artifact: Parameters<typeof collectPatches>[0]
): string | null {
  const patchesByRepo = collectPatches(artifact);
  const filesChanged = new Set<string>();
  for (const [repoName, patches] of patchesByRepo) {
    for (const patch of patches) {
      filesChanged.add(`${repoName}:${patch.patch.path}`);
    }
  }

  if (patchesByRepo.size === 0) {
    return null;
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
