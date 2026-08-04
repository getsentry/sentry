import {useMemo} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  collectPatches,
  getAutofixArtifactFromSection,
  isCodeChangesArtifact,
  type AutofixSection,
  type useExplorerAutofix,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t, tn} from 'sentry/locale';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';

import {IssuePreviewSection} from './issuePreviewSection';
import {RetryableAutofixSection} from './retryableAutofixSection';
import {WorkingIndicator} from './workingIndicator';

export function IssuePreviewAutofixProposalSection({
  autofix,
  defaultExpanded,
  section,
}: {
  autofix: ReturnType<typeof useExplorerAutofix>;
  defaultExpanded: boolean;
  section: AutofixSection;
}) {
  const patchesByRepo = useMemo(() => {
    const artifact = getAutofixArtifactFromSection(section);
    return collectPatches(isCodeChangesArtifact(artifact) ? artifact : []);
  }, [section]);

  const filesChanged = [...patchesByRepo.values()].reduce(
    (count, patches) => count + patches.length,
    0
  );

  const proposalSummary =
    patchesByRepo.size === 1
      ? tn('%s file changed in 1 repo', '%s files changed in 1 repo', filesChanged)
      : t('%s files changed in %s repos', filesChanged, patchesByRepo.size);

  return (
    <RetryableAutofixSection autofix={autofix} section={section} step="code_changes">
      <IssuePreviewSection title={t('Proposal')} defaultExpanded={defaultExpanded}>
        <IssuePreviewSection.Title trailingItems={<RetryableAutofixSection.Button />}>
          {t('Proposal')}
        </IssuePreviewSection.Title>
        <IssuePreviewSection.Summary>
          <RetryableAutofixSection.Prompt
            placeholder={t('Give seer additional context to improve this proposal.')}
            prompt={t('How can this code change be improved?')}
          />
          {section.status === 'processing' ? (
            <WorkingIndicator>{t('Generating proposal...')}</WorkingIndicator>
          ) : patchesByRepo.size > 0 ? (
            <Text>{proposalSummary}</Text>
          ) : (
            <Text variant="muted">{t('No code changes were proposed.')}</Text>
          )}
        </IssuePreviewSection.Summary>
        <IssuePreviewSection.Content>
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
        </IssuePreviewSection.Content>
      </IssuePreviewSection>
    </RetryableAutofixSection>
  );
}
