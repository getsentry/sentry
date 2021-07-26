import {useContext, useEffect} from 'react';
import {InjectedRouter} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {openDebugFileSourceModal} from 'app/actionCreators/modal';
import ProjectActions from 'app/actions/projectActions';
import {Client} from 'app/api';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownButton from 'app/components/dropdownButton';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import MenuItem from 'app/components/menuItem';
import {Panel, PanelBody, PanelHeader} from 'app/components/panels';
import AppStoreConnectContext from 'app/components/projects/appStoreConnectContext';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import {CustomRepo, CustomRepoType} from 'app/types/debugFiles';
import {defined} from 'app/utils';

import Repository from './repository';
import {
  customRepoTypeLabel,
  dropDownItems,
  expandKeys,
  getRequestMessages,
} from './utils';

type Props = {
  api: Client;
  organization: Organization;
  projectSlug: Project['slug'];
  customRepositories: CustomRepo[];
  router: InjectedRouter;
  location: Location;
};

function CustomRepositories({
  api,
  organization,
  customRepositories: repositories,
  projectSlug,
  router,
  location,
}: Props) {
  const appStoreConnectContext = useContext(AppStoreConnectContext);

  useEffect(() => {
    openDebugFileSourceDialog();
  }, [location.query, appStoreConnectContext]);

  const hasAppConnectStoreFeatureFlag =
    !!organization.features?.includes('app-store-connect');

  if (
    hasAppConnectStoreFeatureFlag &&
    !appStoreConnectContext &&
    !dropDownItems.find(
      dropDownItem => dropDownItem.value === CustomRepoType.APP_STORE_CONNECT
    ) &&
    !repositories.find(repository => repository.type === CustomRepoType.APP_STORE_CONNECT)
  ) {
    dropDownItems.push({
      value: CustomRepoType.APP_STORE_CONNECT,
      label: customRepoTypeLabel[CustomRepoType.APP_STORE_CONNECT],
      searchKey: t('apple store connect itunes ios'),
    });
  }

  function openDebugFileSourceDialog() {
    const {customRepository} = location.query;

    if (!customRepository) {
      return;
    }

    const itemIndex = repositories.findIndex(v => v.id === customRepository);
    const item = repositories[itemIndex];

    if (!item) {
      return;
    }

    openDebugFileSourceModal({
      sourceConfig: item,
      sourceType: item.type,
      appStoreConnectContext,
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
    updatedItems?: CustomRepo[];
    updatedItem?: CustomRepo;
    index?: number;
    refresh?: boolean;
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
      `/projects/${organization.slug}/${projectSlug}/`,
      {
        method: 'PUT',
        data: {symbolSources},
      }
    );

    promise.catch(() => {
      addErrorMessage(errorMessage);
    });

    promise.then(result => {
      ProjectActions.updateSuccess(result);
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
        revalidateItunesSession: undefined,
      },
    });
  }

  function handleAddRepository(repoType: CustomRepoType) {
    openDebugFileSourceModal({
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

  function handleEditRepository(
    repoId: CustomRepo['id'],
    revalidateItunesSession?: boolean
  ) {
    router.push({
      ...location,
      query: {
        ...location.query,
        customRepository: repoId,
        revalidateItunesSession,
      },
    });
  }

  return (
    <Panel>
      <PanelHeader hasButtons>
        {t('Custom Repositories')}
        <DropdownAutoComplete
          items={dropDownItems.map(dropDownItem => ({
            ...dropDownItem,
            label: (
              <StyledMenuItem
                onClick={event => {
                  event.preventDefault();
                  handleAddRepository(dropDownItem.value);
                }}
              >
                {dropDownItem.label}
              </StyledMenuItem>
            ),
          }))}
        >
          {({isOpen}) => (
            <DropdownButton isOpen={isOpen} size="small">
              {t('Add Repository')}
            </DropdownButton>
          )}
        </DropdownAutoComplete>
      </PanelHeader>
      <PanelBody>
        {!repositories.length ? (
          <EmptyStateWarning>
            <p>{t('No custom repositories configured')}</p>
          </EmptyStateWarning>
        ) : (
          repositories.map((repository, index) => {
            const repositoryCopy = {...repository};
            if (
              repositoryCopy.type === CustomRepoType.APP_STORE_CONNECT &&
              repositoryCopy.id === appStoreConnectContext?.id
            ) {
              repositoryCopy.details = appStoreConnectContext;
            }
            return (
              <Repository
                key={index}
                repository={repositoryCopy}
                onDelete={handleDeleteRepository}
                onEdit={handleEditRepository}
              />
            );
          })
        )}
      </PanelBody>
    </Panel>
  );
}

export default CustomRepositories;

const StyledMenuItem = styled(MenuItem)`
  color: ${p => p.theme.textColor};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: 400;
  text-transform: none;
  span {
    padding: 0;
  }
`;
