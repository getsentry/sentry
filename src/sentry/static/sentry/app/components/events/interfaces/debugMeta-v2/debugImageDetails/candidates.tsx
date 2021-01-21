import React from 'react';
import styled from '@emotion/styled';

import ExternalLink from 'app/components/links/externalLink';
import PanelTable from 'app/components/panels/panelTable';
import QuestionTooltip from 'app/components/questionTooltip';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {BuiltinSymbolSource} from 'app/types/debugFiles';
import {Image} from 'app/types/debugImage';

import Candidate from './candidate';

type Props = {
  candidates: Image['candidates'];
  organization: Organization;
  projectId: Project['id'];
  baseUrl: string;
  builtinSymbolSources: Array<BuiltinSymbolSource> | null;
  onDelete: (debugId: string) => void;
  isLoading: boolean;
};

function Candidates({
  candidates,
  organization,
  projectId,
  baseUrl,
  builtinSymbolSources,
  onDelete,
  isLoading,
}: Props) {
  return (
    <Wrapper>
      <Title>
        {t('Debug Files')}
        <QuestionTooltip
          title={tct(
            'These are the Debug Information Files (DIFs) corresponding to this image which have been looked up on [docLink:symbol servers] during the processing of the stacktrace.',
            {
              docLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/native/data-management/debug-files/#symbol-servers" />
              ),
            }
          )}
          size="xs"
          position="top"
          isHoverable
        />
      </Title>
      <StyledPanelTable
        headers={[
          t('Status'),
          t('Debug File'),
          t('Processing'),
          t('Features'),
          t('Actions'),
        ]}
        isEmpty={!candidates.length}
        isLoading={isLoading}
        emptyMessage={t('There are no debug files to display')}
      >
        {candidates.map((candidate, index) => (
          <Candidate
            key={index}
            candidate={candidate}
            builtinSymbolSources={builtinSymbolSources}
            organization={organization}
            baseUrl={baseUrl}
            projectId={projectId}
            onDelete={onDelete}
          />
        ))}
      </StyledPanelTable>
    </Wrapper>
  );
}

export default Candidates;

const Wrapper = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
`;

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 0.5fr minmax(300px, 2fr) 1fr 1fr;

  > *:nth-child(5n) {
    padding: 0;
    display: none;
  }

  > *:nth-child(5n-1),
  > *:nth-child(5n) {
    text-align: right;
    justify-content: flex-end;
  }

  @media (min-width: ${p => p.theme.breakpoints[3]}) {
    overflow: visible;
    > *:nth-child(5n-1) {
      text-align: left;
      justify-content: flex-start;
    }

    > *:nth-child(5n) {
      padding: ${space(2)};
      display: flex;
    }

    grid-template-columns: 1fr minmax(300px, 2.5fr) 1.5fr 1.5fr 0.5fr;
  }
`;

// Table Title
const Title = styled('div')`
  display: grid;
  grid-gap: ${space(0.5)};
  grid-template-columns: repeat(2, max-content);
  align-items: center;
  font-weight: 600;
  color: ${p => p.theme.gray400};
`;
