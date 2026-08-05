import {useCallback, useEffect} from 'react';
import type {Location} from 'history';

import {Tooltip} from '@sentry/scraps/tooltip';

import {openDebugFileSourceModal} from 'sentry/actionCreators/modal';
import {Access} from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import type {CustomRepo, CustomRepoType} from 'sentry/types/debugFiles';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {useNavigate} from 'sentry/utils/useNavigate';

import {Repository} from './repository';
import type {RepositoryConfig} from './updateCustomRepositoriesMutation';
import {useUpdateCustomRepositoriesMutation} from './updateCustomRepositoriesMutation';
import {dropDownItems} from './utils';

type Props = {
  customRepositories: CustomRepo[];
  location: Location;
  organization: Organization;
  project: Project;
};

export function CustomRepositories({
  organization,
  customRepositories: repositories,
  project,
  location,
}: Props) {
  const navigate = useNavigate();
  const {mutateAsync: updateCustomRepositories} = useUpdateCustomRepositoriesMutation(
    project,
    repositories.length
  );

  const persistData = useCallback(
    async ({
      updatedItems,
      updatedItem,
      index,
    }: {
      index?: number;
      updatedItem?: RepositoryConfig;
      updatedItems?: RepositoryConfig[];
    }) => {
      let items = updatedItems ?? [];

      if (updatedItem && defined(index)) {
        items = [...repositories];
        items.splice(index, 1, updatedItem);
      }

      await updateCustomRepositories({repositories: items});
    },
    [repositories, updateCustomRepositories]
  );

  const handleCloseModal = useCallback(() => {
    navigate({
      ...location,
      query: {
        ...location.query,
        customRepository: undefined,
      },
    });
  }, [location, navigate]);

  const openDebugFileSourceDialog = useCallback(() => {
    const {customRepository} = location.query;

    if (!customRepository) {
      return;
    }

    const itemIndex = repositories.findIndex(
      repository => repository.id === customRepository
    );

    const item = repositories[itemIndex];

    if (!item) {
      return;
    }

    openDebugFileSourceModal({
      organization,
      sourceConfig: item,
      sourceType: item.type,
      onSave: updatedItem => persistData({updatedItem, index: itemIndex}),
      onClose: handleCloseModal,
    });
  }, [handleCloseModal, location.query, organization, persistData, repositories]);

  useEffect(() => {
    openDebugFileSourceDialog();
  }, [location.query, openDebugFileSourceDialog]);

  function handleAddRepository(repoType: CustomRepoType) {
    openDebugFileSourceModal({
      organization,
      sourceType: repoType,
      onSave: updatedData => persistData({updatedItems: [...repositories, updatedData]}),
    });
  }

  function handleDeleteRepository(repoId: CustomRepo['id']) {
    const newRepositories = [...repositories];
    const index = newRepositories.findIndex(item => item.id === repoId);
    newRepositories.splice(index, 1);
    persistData({updatedItems: newRepositories});
  }

  function handleEditRepository(repoId: CustomRepo['id']) {
    navigate({
      ...location,
      query: {
        ...location.query,
        customRepository: repoId,
      },
    });
  }

  return (
    <Feature features="custom-symbol-sources" organization={organization}>
      {({hasFeature}) => (
        <Access access={['project:write']} project={project}>
          {({hasAccess}) => {
            const addRepositoryButtonDisabled = !hasAccess;
            return (
              <Panel>
                <PanelHeader hasButtons>
                  {t('Custom Repositories')}
                  <Tooltip
                    title={
                      hasAccess
                        ? undefined
                        : t('You do not have permission to add custom repositories.')
                    }
                  >
                    <DropdownMenu
                      usePortal
                      triggerLabel={t('Add Repository')}
                      triggerProps={{size: 'xs'}}
                      items={dropDownItems.map(item => ({
                        ...item,
                        onAction: () => handleAddRepository(item.key),
                      }))}
                      isDisabled={addRepositoryButtonDisabled}
                      position="bottom-end"
                    />
                  </Tooltip>
                </PanelHeader>
                <PanelBody>
                  {repositories.length ? (
                    repositories.map(repository => (
                      <Repository
                        key={repository.id}
                        repository={repository}
                        hasFeature={hasFeature}
                        hasAccess={hasAccess}
                        onDelete={handleDeleteRepository}
                        onEdit={handleEditRepository}
                      />
                    ))
                  ) : (
                    <EmptyStateWarning>
                      <p>{t('No custom repositories configured')}</p>
                    </EmptyStateWarning>
                  )}
                </PanelBody>
              </Panel>
            );
          }}
        </Access>
      )}
    </Feature>
  );
}
