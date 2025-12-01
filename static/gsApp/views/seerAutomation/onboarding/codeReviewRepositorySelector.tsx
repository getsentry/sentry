import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Checkbox} from '@sentry/scraps/checkbox';

import {PanelTable} from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';

interface CodeReviewRepositorySelectorProps {
  repositories: Repository[];
}

export function CodeReviewRepositorySelector({
  repositories,
}: CodeReviewRepositorySelectorProps) {
  return (
    <StyledPanelTable
      headers={[t('Repositories'), t('PR Code Review')]}
      isEmpty={!repositories.length}
      emptyMessage={t('No repositories selected')}
    >
      {repositories.map(repository => (
        <Fragment key={repository.id}>
          <RepositoryName>{repository.name}</RepositoryName>
          <CheckboxCell>
            <Checkbox id={`pr-review-${repository.id}`} />
          </CheckboxCell>
        </Fragment>
      ))}
    </StyledPanelTable>
  );
}

const StyledPanelTable = styled(PanelTable)`
  margin: ${p => p.theme.space.md} ${p => p.theme.space.lg} ${p => p.theme.space.lg};
`;

const RepositoryName = styled('div')`
  display: flex;
  align-items: center;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
`;

const CheckboxCell = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
`;
