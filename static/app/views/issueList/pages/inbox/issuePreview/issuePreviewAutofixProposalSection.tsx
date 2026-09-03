import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

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

import {CopySectionMarkdown} from './copySectionMarkdown';
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
      <IssuePreviewSection
        aria-label={t('Code Changes')}
        defaultExpanded={defaultExpanded}
      >
        <IssuePreviewSection.Title
          trailingItems={
            <Fragment>
              <RetryableAutofixSection.Button />
              <CopySectionMarkdown section={section} />
            </Fragment>
          }
        >
          {t('Code Changes')}
        </IssuePreviewSection.Title>
        <IssuePreviewSection.Summary>
          <RetryableAutofixSection.Prompt
            placeholder={t('Give Seer additional context to improve these code changes.')}
            prompt={t('How can this code change be improved?')}
          />
          {section.status === 'processing' ? (
            <WorkingIndicator blocks={section.blocks}>
              {t('Generating code changes...')}
            </WorkingIndicator>
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
                <FileDiffList gap="0">
                  {patches.map(patch => (
                    <FileDiffViewer
                      key={patch.patch.path}
                      patch={patch.patch}
                      repoName={repoName}
                      showBorder
                      collapsible
                    />
                  ))}
                </FileDiffList>
              </Stack>
            ))}
          </Stack>
        </IssuePreviewSection.Content>
      </IssuePreviewSection>
    </RetryableAutofixSection>
  );
}

const FileDiffList = styled(Stack)`
  & > :not(:first-child) {
    border-top: 0;
    border-top-left-radius: 0;
    border-top-right-radius: 0;
  }

  & > :not(:last-child) {
    border-bottom-left-radius: 0;
    border-bottom-right-radius: 0;
  }
`;
