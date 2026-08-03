import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Markdown} from '@sentry/scraps/markdown';
import {Heading, Text} from '@sentry/scraps/text';

import {
  collectPatches,
  getAutofixArtifactFromSection,
  getOrderedAutofixSections,
  isCodeChangesArtifact,
  isCodeChangesSection,
  isRootCauseArtifact,
  isRootCauseSection,
  isSolutionArtifact,
  isSolutionSection,
  type ExplorerAutofixState,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tn} from 'sentry/locale';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';

interface IssuePreviewAutofixSummaryProps {
  runState: ExplorerAutofixState | null;
}

export function IssuePreviewAutofixSummary({runState}: IssuePreviewAutofixSummaryProps) {
  const sections = useMemo(() => getOrderedAutofixSections(runState), [runState]);

  const proposalSection = sections.findLast(isCodeChangesSection);
  const planSection = sections.findLast(isSolutionSection);
  const rootCauseSection = sections.findLast(isRootCauseSection);

  const proposalArtifact = useMemo(() => {
    const artifact = proposalSection
      ? getAutofixArtifactFromSection(proposalSection)
      : null;
    return isCodeChangesArtifact(artifact) ? artifact : null;
  }, [proposalSection]);
  const planArtifact = useMemo(() => {
    const artifact = planSection ? getAutofixArtifactFromSection(planSection) : null;
    return isSolutionArtifact(artifact) && artifact.data ? artifact.data : null;
  }, [planSection]);
  const rootCauseArtifact = useMemo(() => {
    const artifact = rootCauseSection
      ? getAutofixArtifactFromSection(rootCauseSection)
      : null;
    return isRootCauseArtifact(artifact) && artifact.data ? artifact.data : null;
  }, [rootCauseSection]);

  const patchesByRepo = useMemo(
    () => collectPatches(proposalArtifact ?? []),
    [proposalArtifact]
  );

  if (!runState) {
    return null;
  }

  const isProposalProcessing = proposalSection?.status === 'processing';
  const isPlanProcessing = planSection?.status === 'processing';
  const isRootCauseProcessing = rootCauseSection?.status === 'processing';
  const hasProposal = patchesByRepo.size > 0;
  if (
    !hasProposal &&
    !isProposalProcessing &&
    !planArtifact &&
    !isPlanProcessing &&
    !rootCauseArtifact &&
    !isRootCauseProcessing
  ) {
    return null;
  }

  const filesChanged = [...patchesByRepo.values()].reduce(
    (count, patches) => count + patches.length,
    0
  );
  const proposalSummary =
    patchesByRepo.size === 1
      ? tn('%s file changed in 1 repo', '%s files changed in 1 repo', filesChanged)
      : t('%s files changed in %s repos', filesChanged, patchesByRepo.size);
  const defaultExpandedSection = hasProposal
    ? 'proposal'
    : planArtifact || isPlanProcessing
      ? 'plan'
      : 'rootCause';

  return (
    <Dividers>
      {hasProposal || isProposalProcessing ? (
        <Container>
          <Disclosure
            as="section"
            aria-label={t('Proposal')}
            size="md"
            defaultExpanded={defaultExpandedSection === 'proposal'}
          >
            <Disclosure.Title>
              <Heading as="h3" size="md">
                {t('Proposal')}
              </Heading>
            </Disclosure.Title>
            <SummaryContainer>
              {isProposalProcessing ? (
                <WorkingIndicator>{t('Generating proposal...')}</WorkingIndicator>
              ) : (
                <Text>{proposalSummary}</Text>
              )}
            </SummaryContainer>
            <Disclosure.Content>
              <Stack gap="lg">
                {Array.from(patchesByRepo.entries(), ([repoName, patches]) => (
                  <Stack key={repoName} gap="md">
                    <Text bold>{repoName}</Text>
                    {patches.map(patch => (
                      <FileDiffViewer
                        key={patch.patch.path}
                        patch={patch.patch}
                        repoName={repoName}
                        showBorder
                        collapsible
                        defaultExpanded
                      />
                    ))}
                  </Stack>
                ))}
              </Stack>
            </Disclosure.Content>
          </Disclosure>
        </Container>
      ) : null}

      {planArtifact || isPlanProcessing ? (
        <Container>
          <Disclosure
            as="section"
            aria-label={t('Implementation Plan')}
            size="md"
            defaultExpanded={defaultExpandedSection === 'plan'}
          >
            <Disclosure.Title>
              <Heading as="h3" size="md">
                {t('Implementation Plan')}
              </Heading>
            </Disclosure.Title>
            <SummaryContainer>
              {isPlanProcessing ? (
                <WorkingIndicator>
                  {t('Generating implementation plan...')}
                </WorkingIndicator>
              ) : planArtifact ? (
                <Markdown raw={planArtifact.one_line_summary} />
              ) : null}
            </SummaryContainer>
            <Disclosure.Content>
              {planArtifact?.steps.length ? (
                <Stack gap="md">
                  <Text bold>{t('Steps to Resolve')}</Text>
                  <Stack as="ol" gap="md" paddingLeft="xl">
                    {planArtifact.steps.map((step, index) => (
                      <Container as="li" key={index}>
                        <Stack gap="xs">
                          <Markdown raw={step.title} />
                          <Text size="sm" variant="muted">
                            {step.description}
                          </Text>
                        </Stack>
                      </Container>
                    ))}
                  </Stack>
                </Stack>
              ) : null}
            </Disclosure.Content>
          </Disclosure>
        </Container>
      ) : null}

      {rootCauseArtifact || isRootCauseProcessing ? (
        <Container>
          <Disclosure
            as="section"
            aria-label={t('Root Cause')}
            size="md"
            defaultExpanded={defaultExpandedSection === 'rootCause'}
          >
            <Disclosure.Title>
              <Heading as="h3" size="md">
                {t('Root Cause')}
              </Heading>
            </Disclosure.Title>
            <SummaryContainer>
              {isRootCauseProcessing ? (
                <WorkingIndicator>{t('Generating root cause...')}</WorkingIndicator>
              ) : rootCauseArtifact ? (
                <Markdown raw={rootCauseArtifact.one_line_description} />
              ) : null}
            </SummaryContainer>
            <Disclosure.Content>
              <Stack gap="lg">
                {rootCauseArtifact?.five_whys.length ? (
                  <Stack gap="md">
                    <Text bold>{t('Why did this happen?')}</Text>
                    <Stack as="ul" gap="sm" paddingLeft="xl">
                      {rootCauseArtifact.five_whys.map((why, index) => (
                        <Container as="li" key={index}>
                          <Markdown raw={why} />
                        </Container>
                      ))}
                    </Stack>
                  </Stack>
                ) : null}
                {rootCauseArtifact?.reproduction_steps?.length ? (
                  <Stack gap="md">
                    <Text bold>{t('Reproduction Steps')}</Text>
                    <Stack as="ol" gap="sm" paddingLeft="xl">
                      {rootCauseArtifact.reproduction_steps.map((step, index) => (
                        <Container as="li" key={index}>
                          <Markdown raw={step} />
                        </Container>
                      ))}
                    </Stack>
                  </Stack>
                ) : null}
              </Stack>
            </Disclosure.Content>
          </Disclosure>
        </Container>
      ) : null}
    </Dividers>
  );
}

function WorkingIndicator({children}: {children: React.ReactNode}) {
  return (
    <Flex align="center" gap="sm">
      <WorkingSpinner size={16} />
      <Text variant="muted">{children}</Text>
    </Flex>
  );
}

// Summary container is always displayed event if Disclosure is closed
// Left padding needs to match the indent of Disclosure.Content
const SummaryContainer = styled(Container)`
  padding: 0 ${p => p.theme.space.md} ${p => p.theme.space.md} 26px;
`;

const WorkingSpinner = styled(LoadingIndicator)`
  margin: 0;
`;

const Dividers = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};

  & > * + * {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
    padding-top: ${p => p.theme.space.md};
  }
`;
