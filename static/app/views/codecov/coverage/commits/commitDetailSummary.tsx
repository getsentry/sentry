import styled from '@emotion/styled';

import {
  SummaryContainer,
  SummaryEntries,
  SummaryEntry,
  SummaryEntryLabel,
  SummaryEntryValue,
  SummaryEntryValueLink,
} from 'sentry/components/codecov/summary';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';

const headCommit = {
  sha: '31b72ff64bd75326ea5e43bf8e93b415db56cb62',
  shortSha: '31b72ff',
};

const baseCommit = {
  sha: 'da46d4c13e4a75b7624c8c6763816ecb6dad1968',
  shortSha: 'da46d4c',
};

export function CommitDetailSummary() {
  return (
    <SummaryContainer columns={12}>
      <SelectedCommitPanel>
        <PanelHeader>{t('Coverage On Selected Commit')}</PanelHeader>
        <PanelBody>
          <SummaryEntries largeColumnSpan={6} smallColumnSpan={2}>
            <SummaryEntry>
              <SummaryEntryLabel
                showUnderline
                body={<p>{t('Repository coverage tooltip')}</p>}
              >
                {t('Repository coverage')}
              </SummaryEntryLabel>
              <SummaryEntryValue>98.98%</SummaryEntryValue>
              <StyledSubText>
                {t('Head commit')}{' '}
                <Link to={`/codecov/coverage/commits/${headCommit.sha}`}>
                  {headCommit.shortSha}
                </Link>
              </StyledSubText>
            </SummaryEntry>
            <SummaryEntry>
              <SummaryEntryLabel
                showUnderline
                body={<p>{t('Patch coverage tooltip')}</p>}
              >
                {t('Patch coverage')}
              </SummaryEntryLabel>
              <SummaryEntryValue>100%</SummaryEntryValue>
            </SummaryEntry>
            <SummaryEntry>
              <SummaryEntryLabel
                showUnderline
                body={<p>{t('Uncovered lines tooltip')}</p>}
              >
                {t('Uncovered lines')}
              </SummaryEntryLabel>
              <SummaryEntryValueLink filterBy="uncoveredLines">5</SummaryEntryValueLink>
            </SummaryEntry>
            <SummaryEntry>
              <SummaryEntryLabel showUnderline body={<p>{t('Files changed tooltip')}</p>}>
                {t('Files changed')}
              </SummaryEntryLabel>
              <SummaryEntryValueLink filterBy="filesChanged">4</SummaryEntryValueLink>
            </SummaryEntry>
            <SummaryEntry>
              <SummaryEntryLabel
                showUnderline
                body={<p>{t('Indirect changes tooltip')}</p>}
              >
                {t('Indirect changes')}
              </SummaryEntryLabel>
              <SummaryEntryValueLink filterBy="indirectChanges">1</SummaryEntryValueLink>
            </SummaryEntry>
            <SourceEntry>
              <SummaryEntryLabel showUnderline body={<p>{t('Source tooltip')}</p>}>
                {t('Source')}
              </SummaryEntryLabel>
              <SourceText>
                {t('This commit %s compared to', headCommit.shortSha)}{' '}
                <Link to={`/codecov/coverage/commits/${baseCommit.sha}`}>
                  {baseCommit.shortSha}
                </Link>
              </SourceText>
            </SourceEntry>
          </SummaryEntries>
        </PanelBody>
      </SelectedCommitPanel>
      <UploadsPanel>
        <PanelHeader>{t('Coverage Uploads - %s', headCommit.shortSha)}</PanelHeader>
        <PanelBody>
          <SummaryEntries largeColumnSpan={1} smallColumnSpan={1}>
            <SummaryEntry>
              <SummaryEntryLabel showUnderline body={<p>{t('Uploads count tooltip')}</p>}>
                {t('Uploads count')}
              </SummaryEntryLabel>
              <SummaryEntryValueLink filterBy="uploadsCount">65</SummaryEntryValueLink>
              <StyledSubText>{t('(%s processed, %s pending)', 65, 15)}</StyledSubText>
            </SummaryEntry>
          </SummaryEntries>
        </PanelBody>
      </UploadsPanel>
    </SummaryContainer>
  );
}

const StyledSubText = styled('p')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.gray300};
`;

const SourceText = styled('p')`
  font-size: ${p => p.theme.fontSize.sm};
`;

const SourceEntry = styled(SummaryEntry)`
  word-break: break-word;
  overflow-wrap: break-word;
  max-width: 85%;
`;

const SelectedCommitPanel = styled(Panel)`
  grid-column: span 12;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-column: span 9;
  }
`;

const UploadsPanel = styled(Panel)`
  grid-column: span 12;

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-column: span 3;
  }
`;
