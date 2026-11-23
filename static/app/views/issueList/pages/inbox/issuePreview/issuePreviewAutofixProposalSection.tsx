import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  collectPatches,
  getAutofixArtifactFromSection,
  isCodeChangesArtifact,
  type AutofixSection,
} from 'sentry/components/events/autofix/useExplorerAutofix';
import {t, tn} from 'sentry/locale';
import {FileDiffViewer} from 'sentry/views/seerExplorer/components/fileDiffViewer';

import {IssuePreviewSection} from './issuePreviewSection';
import {WorkingIndicator} from './workingIndicator';

export function IssuePreviewAutofixProposalSection({section}: {section: AutofixSection}) {
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
    <IssuePreviewSection
      section={section}
      summary={
        section.status === 'processing' ? (
          <WorkingIndicator blocks={section.blocks}>
            {t('Generating code changes...')}
          </WorkingIndicator>
        ) : patchesByRepo.size > 0 ? (
          <Text>{proposalSummary}</Text>
        ) : (
          <Text variant="muted">{t('No code changes were proposed.')}</Text>
        )
      }
    >
      {patchesByRepo.size > 0 && (
        <Stack gap="lg">
          {Array.from(patchesByRepo.entries(), ([repoName, patches]) => (
            <Stack key={repoName} gap="md">
              <Text bold>{repoName}</Text>
              <FileDiffList gap="0">
                {patches.map(patch => (
                  <FileDiffViewer
                    key={patch.patch.path}
                    patch={patch.patch}
                    fileUrl={patch.code_url}
                    repoName={repoName}
                    showBorder
                    collapsible
                  />
                ))}
              </FileDiffList>
            </Stack>
          ))}
        </Stack>
      )}
    </IssuePreviewSection>
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
