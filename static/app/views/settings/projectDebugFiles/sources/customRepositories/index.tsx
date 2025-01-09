import {useCallback, useEffect} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openDebugFileSourceModal} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownButton from 'sentry/components/dropdownButton';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import MenuItem from 'sentry/components/menuItem';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {CustomRepo, CustomRepoType} from 'sentry/types/debugFiles';
import type {InjectedRouter} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';

import Repository from './repository';
import {dropDownItems, expandKeys, getRequestMessages} from './utils';

type Props = {
  api: Client;
  customRepositories: CustomRepo[];
  location: Location;
  organization: Organization;
  project: Project;
  router: InjectedRouter;
};

function CustomRepositories({
  api,
  organization,
  customRepositories: repositories,
  project,
  router,
  location,
}: Props) {
  const orgSlug = organization.slug;

  const persistData = useCallback(
    ({
      updatedItems,
      updatedItem,
      index,
      refresh,
    }: {
      index?: number;
      refresh?: boolean;
      updatedItem?: CustomRepo;
      updatedItems?: CustomRepo[];
    }) => {
      let items = updatedItems ?? [];

      if (updatedItem && defined(index)) {
        items = [...repositories];
        items.splice(index, 1, updatedItem);
      }

      const {successMessage, errorMessage} = getRequestMessages(
        items.length,
        repositories.length
      );

      const symbolSources = JSON.stringify(items.map(expandKeys));

      const promise: Promise<any> = api.requestPromise(
        `/projects/${orgSlug}/${project.slug}/`,
        {
          method: 'PUT',
          data: {symbolSources},
        }
      );

      promise.catch(() => {
        addErrorMessage(errorMessage);
      });

      promise.then(result => {
        ProjectsStore.onUpdateSuccess(result);
        addSuccessMessage(successMessage);

        if (refresh) {
          window.location.reload();
        }
      });

      return promise;
    },
    [api, orgSlug, project.slug, repositories]
  );

  const handleCloseModal = useCallback(() => {
    router.push({
      ...location,
      query: {
        ...location.query,
        customRepository: undefined,
      },
    });
  }, [location, router]);

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
      onSave: updatedItem =>
        persistData({updatedItem: updatedItem as CustomRepo, index: itemIndex}),
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
      onSave: updatedData =>
        persistData({updatedItems: [...repositories, updatedData] as CustomRepo[]}),
    });
  }

  function handleDeleteRepository(repoId: CustomRepo['id']) {
    const newRepositories = [...repositories];
    const index = newRepositories.findIndex(item => item.id === repoId);
    newRepositories.splice(index, 1);
    persistData({
      updatedItems: newRepositories as CustomRepo[],
      refresh: false,
    });
  }

  function handleEditRepository(repoId: CustomRepo['id']) {
    router.push({
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
                      !hasAccess
                        ? t('You do not have permission to add custom repositories.')
                        : undefined
                    }
                  >
                    <DropdownAutoComplete
                      alignMenu="right"
                      disabled={addRepositoryButtonDisabled}
                      onSelect={item => handleAddRepository(item.value)}
                      items={dropDownItems.map(dropDownItem => ({
                        ...dropDownItem,
                        label: (
                          <DropDownLabel
                            aria-label={t(
                              'Open %s custom repository modal',
                              dropDownItem.label
                            )}
                          >
                            {dropDownItem.label}
                          </DropDownLabel>
                        ),
                      }))}
                    >
                      {({isOpen}) => (
                        <DropdownButton
                          isOpen={isOpen}
                          disabled={addRepositoryButtonDisabled}
                          size="xs"
                          aria-label={t('Add Repository')}
                        >
                          {t('Add Repository')}
                        </DropdownButton>
                      )}
                    </DropdownAutoComplete>
                  </Tooltip>
                </PanelHeader>
                <PanelBody>
                  {!repositories.length ? (
                    <EmptyStateWarning>
                      <p>{t('No custom repositories configured')}</p>
                    </EmptyStateWarning>
                  ) : (
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

export default CustomRepositories;

const DropDownLabel = styled(MenuItem)`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightNormal};
  text-transform: none;
  span {
    padding: 0;
  }
`;
