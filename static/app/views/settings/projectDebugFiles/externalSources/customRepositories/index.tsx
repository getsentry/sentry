import {Fragment, useContext, useEffect} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openDebugFileSourceModal} from 'sentry/actionCreators/modal';
import ProjectActions from 'sentry/actions/projectActions';
import {Client} from 'sentry/api';
import Access from 'sentry/components/acl/access';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownButton from 'sentry/components/dropdownButton';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import HookOrDefault from 'sentry/components/hookOrDefault';
import MenuItem from 'sentry/components/menuItem';
import {Panel, PanelBody, PanelHeader} from 'sentry/components/panels';
import AppStoreConnectContext from 'sentry/components/projects/appStoreConnectContext';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {CustomRepo, CustomRepoType} from 'sentry/types/debugFiles';
import {defined} from 'sentry/utils';

import Repository from './repository';
import {
  customRepoTypeLabel,
  dropDownItems,
  expandKeys,
  getRequestMessages,
} from './utils';

const HookedAppStoreConnectItem = HookOrDefault({
  hookName: 'component:disabled-app-store-connect-item',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

type Props = {
  api: Client;
  organization: Organization;
  projSlug: Project['slug'];
  customRepositories: CustomRepo[];
  router: InjectedRouter;
  location: Location;
};

function CustomRepositories({
  api,
  organization,
  customRepositories: repositories,
  projSlug,
  router,
  location,
}: Props) {
  const appStoreConnectContext = useContext(AppStoreConnectContext);

  useEffect(() => {
    openDebugFileSourceDialog();
  }, [location.query, appStoreConnectContext]);

  const orgSlug = organization.slug;

  const hasAppStoreConnectMultipleFeatureFlag = !!organization.features?.includes(
    'app-store-connect-multiple'
  );

  const hasAppStoreConnectRepo = !!repositories.find(
    repository => repository.type === CustomRepoType.APP_STORE_CONNECT
  );

  if (
    !appStoreConnectContext &&
    !dropDownItems.find(
      dropDownItem => dropDownItem.value === CustomRepoType.APP_STORE_CONNECT
    )
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

    const itemIndex = repositories.findIndex(
      repository => repository.id === customRepository
    );

    const item = repositories[itemIndex];

    if (!item) {
      return;
    }

    openDebugFileSourceModal({
      sourceConfig: item,
      sourceType: item.type,
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
    <Panel>
      <PanelHeader hasButtons>
        {t('Custom Repositories')}
        <DropdownAutoComplete
          alignMenu="right"
          onSelect={item => {
            handleAddRepository(item.value);
          }}
          items={dropDownItems.map(dropDownItem => {
            const disabled =
              dropDownItem.value === CustomRepoType.APP_STORE_CONNECT &&
              hasAppStoreConnectRepo &&
              !hasAppStoreConnectMultipleFeatureFlag;

            return {
              ...dropDownItem,
              value: dropDownItem.value,
              disabled,
              label: (
                <HookedAppStoreConnectItem
                  disabled={disabled}
                  onTrialStarted={() => {
                    handleAddRepository(dropDownItem.value);
                  }}
                >
                  <StyledMenuItem disabled={disabled}>
                    {dropDownItem.label}
                  </StyledMenuItem>
                </HookedAppStoreConnectItem>
              ),
            };
          })}
        >
          {({isOpen}) => (
            <Access access={['project:write']}>
              {({hasAccess}) => (
                <DropdownButton
                  isOpen={isOpen}
                  title={
                    !hasAccess
                      ? t('You do not have permission to add custom repositories.')
                      : undefined
                  }
                  disabled={!hasAccess}
                  size="small"
                >
                  {t('Add Repository')}
                </DropdownButton>
              )}
            </Access>
          )}
        </DropdownAutoComplete>
      </PanelHeader>
      <PanelBody>
        {!repositories.length ? (
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
              onDelete={handleDeleteRepository}
              onEdit={handleEditRepository}
            />
          ))
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
