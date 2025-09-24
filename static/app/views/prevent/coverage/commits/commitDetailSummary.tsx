import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {
  SummaryContainer,
  SummaryEntries,
  SummaryEntry,
  SummaryEntryValue,
  SummaryEntryValueLink,
} from 'sentry/components/prevent/summary';
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
              <Tooltip showUnderline title={t('Repository coverage tooltip')}>
                {t('Repository coverage')}
              </Tooltip>
              <SummaryEntryValue>98.98%</SummaryEntryValue>
              <StyledSubText>
                {t('Head commit')}{' '}
                <Link to={`/prevent/coverage/commits/${headCommit.sha}`}>
                  {headCommit.shortSha}
                </Link>
              </StyledSubText>
            </SummaryEntry>
            <SummaryEntry>
              <Tooltip showUnderline title={t('Patch coverage tooltip')}>
                {t('Patch coverage')}
              </Tooltip>
              <SummaryEntryValue>100%</SummaryEntryValue>
            </SummaryEntry>
            <SummaryEntry>
              <Tooltip showUnderline title={t('Uncovered lines tooltip')}>
                {t('Uncovered lines')}
              </Tooltip>
              <SummaryEntryValueLink filterBy="uncoveredLines">5</SummaryEntryValueLink>
            </SummaryEntry>
            <SummaryEntry>
              <Tooltip showUnderline title={t('Files changed tooltip')}>
                {t('Files changed')}
              </Tooltip>
              <SummaryEntryValueLink filterBy="filesChanged">4</SummaryEntryValueLink>
            </SummaryEntry>
            <SummaryEntry>
              <Tooltip showUnderline title={t('Indirect changes tooltip')}>
                {t('Indirect changes')}
              </Tooltip>
              <SummaryEntryValueLink filterBy="indirectChanges">1</SummaryEntryValueLink>
            </SummaryEntry>
            <SourceEntry>
              <Tooltip showUnderline title={t('Source tooltip')}>
                {t('Source')}
              </Tooltip>
              <SourceText>
                {t('This commit %s compared to', headCommit.shortSha)}{' '}
                <Link to={`/prevent/coverage/commits/${baseCommit.sha}`}>
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
              <Tooltip showUnderline title={t('Uploads count tooltip')}>
                {t('Uploads count')}
              </Tooltip>
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

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-column: span 9;
  }
`;

const UploadsPanel = styled(Panel)`
  grid-column: span 12;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-column: span 3;
  }
`;
