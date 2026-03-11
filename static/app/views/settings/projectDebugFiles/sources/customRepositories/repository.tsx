import styled from '@emotion/styled';

import {PanelItem} from 'sentry/components/panels/panelItem';
import type {CustomRepo} from 'sentry/types/debugFiles';

import {Actions as CustomRepositoryActions} from './actions';
import {customRepoTypeLabel} from './utils';

type Props = {
  hasAccess: boolean;
  hasFeature: boolean;
  onDelete: (repositoryId: string) => void;
  onEdit: (repositoryId: string) => void;
  repository: CustomRepo;
};

export function Repository({repository, onDelete, onEdit, hasFeature, hasAccess}: Props) {
  return (
    <StyledPanelItem>
      <div>
        <div>{repository.name}</div>
        <TypeAndStatus>{customRepoTypeLabel[repository.type]}</TypeAndStatus>
      </div>
      <div>
        <CustomRepositoryActions
          hasFeature={hasFeature}
          hasAccess={hasAccess}
          onDelete={() => onDelete(repository.id)}
          onEdit={() => onEdit(repository.id)}
        />
      </div>
    </StyledPanelItem>
  );
}

const StyledPanelItem = styled(PanelItem)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${p => p.theme.space.md};
`;

const TypeAndStatus = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.md};
  display: flex;
  flex-wrap: wrap;
  align-items: center;
`;
