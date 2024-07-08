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
  const {id, name, type} = repository;

  return (
    <StyledPanelItem>
      <Name>{name}</Name>
      <TypeAndStatus>{customRepoTypeLabel[type]}</TypeAndStatus>
      <CustomRepositoryActions
        repositoryName={name}
        hasFeature={hasFeature}
        hasAccess={hasAccess}
        onDelete={() => onDelete(id)}
        onEdit={() => onEdit(id)}
      />
    </StyledPanelItem>
  );
}

export default Repository;

const StyledPanelItem = styled(PanelItem)`
  display: grid;
  align-items: flex-start;
  gap: ${space(1)};

  grid-template-columns: max-content 1fr;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: max-content 1fr max-content;
  }
`;

const Name = styled('div')`
  grid-column: 2/2;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-column: 2/3;
    grid-row: 1/2;
  }
`;

const TypeAndStatus = styled('div')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  display: flex;
  flex-wrap: wrap;
  align-items: center;

  grid-column: 2/2;
  gap: ${space(1.5)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-column: 2/3;
    grid-row: 2/2;
    gap: ${space(1)};
  }
`;
