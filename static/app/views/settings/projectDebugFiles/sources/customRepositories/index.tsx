import {useContext, useEffect} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openDebugFileSourceModal} from 'sentry/actionCreators/modal';
import {Client} from 'sentry/api';
import Access from 'sentry/components/acl/access';
import Feature from 'sentry/components/acl/feature';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownButton from 'sentry/components/dropdownButton';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import MenuItem from 'sentry/components/menuItem';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import AppStoreConnectContext from 'sentry/components/projects/appStoreConnectContext';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {Organization, Project} from 'sentry/types';
import {CustomRepo, CustomRepoType} from 'sentry/types/debugFiles';
import {defined} from 'sentry/utils';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';

import Repository from './repository';
import {dropDownItems, expandKeys, getRequestMessages} from './utils';

const SECTION_TITLE = t('Custom Repositories');

type Props = {
  api: Client;
  customRepositories: CustomRepo[];
  isLoading: boolean;
  location: Location;
  organization: Organization;
  projSlug: Project['slug'];
  router: InjectedRouter;
};

function CustomRepositories({
  api,
  organization,
  customRepositories: repositories,
  projSlug,
  router,
  location,
  isLoading,
}: Props) {
  const appStoreConnectContext = useContext(AppStoreConnectContext);

  useEffect(() => {
    openDebugFileSourceDialog();
  }, [location.query, appStoreConnectContext]);

  const orgSlug = organization.slug;
  const appStoreConnectSourcesQuantity = repositories.filter(
    repository => repository.type === CustomRepoType.APP_STORE_CONNECT
  ).length;

  function openDebugFileSourceDialog() {
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
      appStoreConnectSourcesQuantity,
      appStoreConnectStatusData: appStoreConnectContext?.[item.id],
      onSave: updatedItem =>
        persistData({updatedItem: updatedItem as CustomRepo, index: itemIndex}),
      onClose: handleCloseModal,
    });
  }

  function persistData({
    updatedItems,
    updatedItem,
    index,
    refresh,
  }: {
    index?: number;
    refresh?: boolean;
    updatedItem?: CustomRepo;
    updatedItems?: CustomRepo[];
  }) {
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
      `/projects/${orgSlug}/${projSlug}/`,
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
  }

  function handleCloseModal() {
    router.push({
      ...location,
      query: {
        ...location.query,
        customRepository: undefined,
      },
    });
  }

  function handleAddRepository(repoType: CustomRepoType) {
    openDebugFileSourceModal({
      organization,
      appStoreConnectSourcesQuantity,
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
      refresh: repositories[index].type === CustomRepoType.APP_STORE_CONNECT,
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

  async function handleSyncRepositoryNow(repoId: CustomRepo['id']) {
    try {
      await api.requestPromise(
        `/projects/${orgSlug}/${projSlug}/appstoreconnect/${repoId}/refresh/`,
        {
          method: 'POST',
        }
      );
      addSuccessMessage(t('Repository sync started.'));
    } catch (error) {
      const errorMessage = t(
        'Rate limit for refreshing repository exceeded. Try again in a few minutes.'
      );
      addErrorMessage(errorMessage);
      handleXhrErrorResponse(errorMessage, error);
    }
  }

  return (
    <Feature features={['custom-symbol-sources']} organization={organization}>
      {({hasFeature}) => (
        <Access access={['project:write']}>
          {({hasAccess}) => {
            const addRepositoryButtonDisabled = !hasAccess || isLoading;
            return (
              <Panel>
                <PanelHeader hasButtons>
                  {SECTION_TITLE}
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
                          size="sm"
                          aria-label={t('Add Repository')}
                        >
                          {t('Add Repository')}
                        </DropdownButton>
                      )}
                    </DropdownAutoComplete>
                  </Tooltip>
                </PanelHeader>
                <PanelBody>
                  {isLoading ? (
                    <LoadingIndicator />
                  ) : !repositories.length ? (
                    <EmptyStateWarning>
                      <p>{t('No custom repositories configured')}</p>
                    </EmptyStateWarning>
                  ) : (
                    repositories.map((repository, index) => (
                      <Repository
                        key={index}
                        repository={
                          repository.type === CustomRepoType.APP_STORE_CONNECT
                            ? {
                                ...repository,
                                details: appStoreConnectContext?.[repository.id],
                              }
                            : repository
                        }
                        hasFeature={
                          repository.type === CustomRepoType.APP_STORE_CONNECT
                            ? hasFeature || appStoreConnectSourcesQuantity === 1
                            : hasFeature
                        }
                        hasAccess={hasAccess}
                        onDelete={handleDeleteRepository}
                        onEdit={handleEditRepository}
                        onSyncNow={handleSyncRepositoryNow}
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
  font-weight: 400;
  text-transform: none;
  span {
    padding: 0;
  }
`;
