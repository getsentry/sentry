import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {CustomRepo, CustomRepoType} from 'sentry/types/debugFiles';

import CustomRepositoryActions from './actions';
import Details from './details';
import Status from './status';
import {customRepoTypeLabel} from './utils';

type Props = {
  hasAccess: boolean;
  hasFeature: boolean;
  onDelete: (repositoryId: string) => void;
  onEdit: (repositoryId: string) => void;
  onSyncNow: (repositoryId: string) => void;
  repository: CustomRepo;
};

function Repository({
  repository,
  onSyncNow,
  onDelete,
  onEdit,
  hasFeature,
  hasAccess,
}: Props) {
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const {id, name, type} = repository;

  if (repository.type === CustomRepoType.APP_STORE_CONNECT) {
    const authenticated = repository.details?.credentials.status !== 'invalid';
    const detailsAvailable = repository.details !== undefined;

    return (
      <StyledPanelItem>
        <ToggleDetails
          size="sm"
          aria-label={t('Toggle details')}
          onClick={() =>
            detailsAvailable ? setIsDetailsExpanded(!isDetailsExpanded) : undefined
          }
          direction={isDetailsExpanded ? 'down' : 'up'}
        />
        <Name>{name}</Name>
        <TypeAndStatus>
          {customRepoTypeLabel[type]}
          <Status details={repository.details} onEditRepository={() => onEdit(id)} />
        </TypeAndStatus>
        <CustomRepositoryActions
          repositoryName={name}
          repositoryType={type}
          hasFeature={hasFeature}
          hasAccess={hasAccess}
          onDelete={() => onDelete(id)}
          onEdit={() => onEdit(id)}
          disabled={repository.details === undefined}
          syncNowButton={
            <Button
              size="sm"
              onClick={() => onSyncNow(id)}
              icon={<IconRefresh />}
              disabled={!detailsAvailable || !authenticated || !hasFeature || !hasAccess}
              title={
                !hasFeature
                  ? undefined
                  : !hasAccess
                  ? t(
                      'You do not have permission to edit custom repositories configurations.'
                    )
                  : !authenticated
                  ? t(
                      'Authentication is required before this repository can sync with App Store Connect.'
                    )
                  : undefined
              }
            >
              {t('Sync Now')}
            </Button>
          }
        />
        {isDetailsExpanded && <Details details={repository.details} />}
      </StyledPanelItem>
    );
  }

  return (
    <StyledPanelItem>
      <Name>{name}</Name>
      <TypeAndStatus>{customRepoTypeLabel[type]}</TypeAndStatus>
      <CustomRepositoryActions
        repositoryName={name}
        repositoryType={type}
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

const ToggleDetails = styled(IconChevron)`
  cursor: pointer;
`;
