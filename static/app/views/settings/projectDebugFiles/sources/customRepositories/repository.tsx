import styled from '@emotion/styled';

import PanelItem from 'sentry/components/panels/panelItem';
import {space} from 'sentry/styles/space';
import type {CustomRepo} from 'sentry/types/debugFiles';

import CustomRepositoryActions from './actions';
import {customRepoTypeLabel} from './utils';

type Props = {
  hasAccess: boolean;
  hasFeature: boolean;
  onDelete: (repositoryId: string) => void;
  onEdit: (repositoryId: string) => void;
  repository: CustomRepo;
};

function Repository({repository, onDelete, onEdit, hasFeature, hasAccess}: Props) {
  return (
    <StyledPanelItem>
      <div>
        <div>{repository.name}</div>
        <TypeAndStatus>{customRepoTypeLabel[repository.type]}</TypeAndStatus>
      </div>
      <div>
        <CustomRepositoryActions
          repositoryName={repository.name}
          hasFeature={hasFeature}
          hasAccess={hasAccess}
          onDelete={() => onDelete(repository.id)}
          onEdit={() => onEdit(repository.id)}
        />
      </div>
    </StyledPanelItem>
  );
}

export default Repository;

const StyledPanelItem = styled(PanelItem)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(1)};
`;

const TypeAndStatus = styled('div')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  display: flex;
  flex-wrap: wrap;
  align-items: center;
`;
