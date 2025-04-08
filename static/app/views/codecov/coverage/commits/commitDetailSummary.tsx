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
        <PanelHeader>Coverage On Selected Commit</PanelHeader>
        <PanelBody>
          <SummaryEntries largeColumnSpan={6} smallColumnSpan={2}>
            <SummaryEntry>
              <SummaryEntryLabel showUnderline body={<p>Repository coverage tooltip</p>}>
                Repository coverage
              </SummaryEntryLabel>
              <SummaryEntryValue>98.98%</SummaryEntryValue>
              <StyledSubText>
                Head commit{' '}
                <Link to={`/codecov/coverage/commits/${headCommit.sha}`}>
                  {headCommit.shortSha}
                </Link>
              </StyledSubText>
            </SummaryEntry>
            <SummaryEntry>
              <SummaryEntryLabel showUnderline body={<p>Patch coverage tooltip</p>}>
                Patch coverage
              </SummaryEntryLabel>
              <SummaryEntryValue>100%</SummaryEntryValue>
            </SummaryEntry>
            <SummaryEntry>
              <SummaryEntryLabel showUnderline body={<p>Uncovered lines tooltip</p>}>
                Uncovered lines
              </SummaryEntryLabel>
              <SummaryEntryValueLink filterBy="uncovered_lines">5</SummaryEntryValueLink>
            </SummaryEntry>
            <SummaryEntry>
              <SummaryEntryLabel showUnderline body={<p>Files changed tooltip</p>}>
                Files changed
              </SummaryEntryLabel>
              <SummaryEntryValueLink filterBy="files_changed">4</SummaryEntryValueLink>
            </SummaryEntry>
            <SummaryEntry>
              <SummaryEntryLabel showUnderline body={<p>Indirect changes tooltip</p>}>
                Indirect changes
              </SummaryEntryLabel>
              <SummaryEntryValueLink filterBy="indirect_changes">1</SummaryEntryValueLink>
            </SummaryEntry>
            <SourceEntry>
              <SummaryEntryLabel showUnderline body={<p>Source tooltip</p>}>
                Source
              </SummaryEntryLabel>
              <SourceText>
                This commit {headCommit.shortSha} compared to{' '}
                <Link to={`/codecov/coverage/commits/${baseCommit.sha}`}>
                  {baseCommit.shortSha}
                </Link>
              </SourceText>
            </SourceEntry>
          </SummaryEntries>
        </PanelBody>
      </SelectedCommitPanel>
      <UploadsPanel>
        <PanelHeader>Coverage Uploads - {headCommit.shortSha}</PanelHeader>
        <PanelBody>
          <SummaryEntries largeColumnSpan={1} smallColumnSpan={1}>
            <SummaryEntry>
              <SummaryEntryLabel showUnderline body={<p>Uploads count tooltip</p>}>
                Uploads count
              </SummaryEntryLabel>
              <SummaryEntryValueLink filterBy="uploads_count">65</SummaryEntryValueLink>
              <StyledSubText>(65 processed, 15 pending)</StyledSubText>
            </SummaryEntry>
          </SummaryEntries>
        </PanelBody>
      </UploadsPanel>
    </SummaryContainer>
  );
}

const StyledSubText = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray300};
`;

const SourceText = styled('p')`
  font-size: ${p => p.theme.fontSizeSmall};
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
