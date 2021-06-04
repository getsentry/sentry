import React, {Fragment, useContext, useEffect} from 'react';
import {InjectedRouter} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import {Location} from 'history';
import omit from 'lodash/omit';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {openDebugFileSourceModal} from 'app/actionCreators/modal';
import ProjectActions from 'app/actions/projectActions';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import Alert from 'app/components/alert';
import {Item} from 'app/components/dropdownAutoComplete/types';
import {getAppConnectStoreUpdateAlertMessage} from 'app/components/globalAppStoreConnectUpdateAlert/utils';
import Link from 'app/components/links/link';
import List from 'app/components/list';
import ListItem from 'app/components/list/listItem';
import AppStoreConnectContext from 'app/components/projects/appStoreConnectContext';
import TextOverflow from 'app/components/textOverflow';
import {DEBUG_SOURCE_TYPES} from 'app/data/debugFileSources';
import {IconRefresh, IconWarning} from 'app/icons';
import {t, tct, tn} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import Field from 'app/views/settings/components/forms/field';
import RichListField from 'app/views/settings/components/forms/richListField';
import TextBlock from 'app/views/settings/components/text/textBlock';

import {expandKeys} from './utils';

type Props = {
  api: Client;
  organization: Organization;
  projectSlug: Project['slug'];
  symbolSources: Item[];
  router: InjectedRouter;
  location: Location;
};

function SymbolSources({
  api,
  organization,
  symbolSources,
  projectSlug,
  router,
  location,
}: Props) {
  const appStoreConnectContext = useContext(AppStoreConnectContext);

  useEffect(() => {
    openDebugFileSourceDialog();
  }, [location.query, appStoreConnectContext]);

  const hasAppConnectStoreFeatureFlag = !!organization.features?.includes(
    'app-store-connect'
  );

  const dropDownItems = [
    {
      value: 's3',
      label: t(DEBUG_SOURCE_TYPES.s3),
      searchKey: t('aws amazon s3 bucket'),
    },
    {
      value: 'gcs',
      label: t(DEBUG_SOURCE_TYPES.gcs),
      searchKey: t('gcs google cloud storage bucket'),
    },
    {
      value: 'http',
      label: t(DEBUG_SOURCE_TYPES.http),
      searchKey: t('http symbol server ssqp symstore symsrv'),
    },
  ];

  const hasSavedAppStoreConnect = symbolSources.find(
    symbolSource => symbolSource.type === 'AppStoreConnect'
  );

  if (
    hasAppConnectStoreFeatureFlag &&
    !hasSavedAppStoreConnect &&
    !dropDownItems.find(dropDownItem => dropDownItem.value === 'appStoreConnect')
  ) {
    dropDownItems.push({
      value: 'appStoreConnect',
      label: t(DEBUG_SOURCE_TYPES.appStoreConnect),
      searchKey: t('apple store connect itunes ios'),
    });
  }

  function getRichListFieldValue(): {
    value: Item[];
    warnings?: React.ReactNode[];
    errors?: React.ReactNode[];
  } {
    if (!hasAppConnectStoreFeatureFlag || appStoreConnectContext.isLoading !== false) {
      return {value: symbolSources};
    }

    const symbolSourcesErrors: React.ReactNode[] = [];
    const symbolSourcesWarnings: React.ReactNode[] = [];

    const symbolSourcesWithErrors = symbolSources.map(symbolSource => {
      if (symbolSource.id === appStoreConnectContext.id) {
        const appStoreConnectErrors: string[] = [];
        let appStoreConnectWarning: React.ReactNode = undefined;
        const customRepositoryLink = `/settings/${organization.slug}/projects/${projectSlug}/debug-symbols/?customRepository=${symbolSource.id}`;

        if (
          appStoreConnectContext.itunesSessionValid &&
          appStoreConnectContext.appstoreCredentialsValid
        ) {
          const appConnectStoreUpdateAlertMessage = getAppConnectStoreUpdateAlertMessage(
            appStoreConnectContext
          );

          if (appConnectStoreUpdateAlertMessage) {
            symbolSourcesWarnings.push(
              <ExpirationMessage>
                {appConnectStoreUpdateAlertMessage}
                {tct('Revalidate your iTunes Session for [link]', {
                  link: (
                    <Link to={`${customRepositoryLink}&revalidateItunesSession=true`}>
                      {symbolSource.name}
                    </Link>
                  ),
                })}
              </ExpirationMessage>
            );
            appStoreConnectWarning = appConnectStoreUpdateAlertMessage;
          }
        }

        if (appStoreConnectContext.itunesSessionValid === false) {
          symbolSourcesErrors.push(
            tct('Revalidate your iTunes Session for [link]', {
              link: (
                <Link to={`${customRepositoryLink}&revalidateItunesSession=true`}>
                  {symbolSource.name}
                </Link>
              ),
            })
          );

          appStoreConnectErrors.push(t('Revalidate your iTunes Session'));
        }

        if (appStoreConnectContext.appstoreCredentialsValid === false) {
          symbolSourcesErrors.push(
            tct('Recheck your App Store Credentials for [link]', {
              link: <Link to={customRepositoryLink}>{symbolSource.name}</Link>,
            })
          );
          appStoreConnectErrors.push(t('Recheck your App Store Credentials'));
        }

        return {
          ...symbolSource,
          error: !!appStoreConnectErrors.length ? (
            <Fragment>
              {tn(
                'There was an error connecting to the Apple Store Connect:',
                'There were errors connecting to the Apple Store Connect:',
                appStoreConnectErrors.length
              )}
              <StyledList symbol="bullet">
                {appStoreConnectErrors.map((error, errorIndex) => (
                  <ListItem key={errorIndex}>{error}</ListItem>
                ))}
              </StyledList>
            </Fragment>
          ) : undefined,
          warning: appStoreConnectWarning,
        };
      }

      return symbolSource;
    });

    return {
      value: symbolSourcesWithErrors,
      errors: symbolSourcesErrors,
      warnings: symbolSourcesWarnings,
    };
  }

  const {value, warnings = [], errors = []} = getRichListFieldValue();

  function openDebugFileSourceDialog() {
    const {customRepository} = location.query;

    if (!customRepository) {
      return;
    }

    const item = value.find(v => v.id === customRepository);

    if (!item) {
      return;
    }

    openDebugFileSourceModal({
      sourceConfig: item,
      sourceType: item.type,
      appStoreConnectContext,
      onSave: updatedData => handleUpdateSymbolSource(updatedData as Item, item.index),
      onClose: handleCloseImageDetailsModal,
    });
  }

  function getRequestMessages(symbolSourcesQuantity: number) {
    if (symbolSourcesQuantity > symbolSources.length) {
      return {
        successMessage: t('Successfully added custom repository'),
        errorMessage: t('An error occurred while adding a new custom repository'),
      };
    }

    if (symbolSourcesQuantity < symbolSources.length) {
      return {
        successMessage: t('Successfully removed custom repository'),
        errorMessage: t('An error occurred while removing the custom repository'),
      };
    }

    return {
      successMessage: t('Successfully updated custom repository'),
      errorMessage: t('An error occurred while updating the custom repository'),
    };
  }

  async function handleChange(updatedSymbolSources: Item[]) {
    const symbolSourcesWithoutErrors = updatedSymbolSources.map(updatedSymbolSource =>
      omit(updatedSymbolSource, 'error')
    );

    const {successMessage, errorMessage} = getRequestMessages(
      updatedSymbolSources.length
    );

    try {
      const updatedProjectDetails: Project = await api.requestPromise(
        `/projects/${organization.slug}/${projectSlug}/`,
        {
          method: 'PUT',
          data: {
            symbolSources: JSON.stringify(symbolSourcesWithoutErrors.map(expandKeys)),
          },
        }
      );

      ProjectActions.updateSuccess(updatedProjectDetails);
      addSuccessMessage(successMessage);
    } catch {
      addErrorMessage(errorMessage);
    }
  }

  function handleUpdateSymbolSource(updatedItem: Item, index: number) {
    const items = [...symbolSources] as Item[];
    items.splice(index, 1, updatedItem);
    handleChange(items);
  }

  function handleOpenDebugFileSourceModalToEdit(repositoryId: string) {
    router.push({
      ...location,
      query: {
        ...location.query,
        customRepository: repositoryId,
      },
    });
  }

  function handleCloseImageDetailsModal() {
    router.push({
      ...location,
      query: {
        ...location.query,
        customRepository: undefined,
        revalidateItunesSession: undefined,
      },
    });
  }

  return (
    <Fragment>
      {!!warnings.length && (
        <Alert type="warning" icon={<IconRefresh />} system>
          {tn(
            'Please check the warning related to the following custom repository:',
            'Please check the warnings related to the following custom repositories:',
            warnings.length
          )}
          <StyledList symbol="bullet">
            {warnings.map((warning, index) => (
              <ListItem key={index}>{warning}</ListItem>
            ))}
          </StyledList>
        </Alert>
      )}
      {!!errors.length && (
        <Alert type="error" icon={<IconWarning />} system>
          {tn(
            'There was an error connecting to the following custom repository:',
            'There were errors connecting to the following custom repositories:',
            errors.length
          )}
          <StyledList symbol="bullet">
            {errors.map((error, index) => (
              <ListItem key={index}>{error}</ListItem>
            ))}
          </StyledList>
        </Alert>
      )}
      <Field
        label={t('Custom Repositories')}
        help={
          <Feature
            features={['organizations:custom-symbol-sources']}
            hookName="feature-disabled:custom-symbol-sources"
            organization={organization}
            renderDisabled={p => (
              <FeatureDisabled
                features={p.features}
                message={t('Custom repositories are disabled.')}
                featureName={t('custom repositories')}
              />
            )}
          >
            {t('Configures custom repositories containing debug files.')}
          </Feature>
        }
        flexibleControlStateSize
      >
        <StyledRichListField
          inline={false}
          addButtonText={t('Add Repository')}
          name="symbolSources"
          value={value}
          onChange={handleChange}
          renderItem={item => (
            <TextOverflow>{item.name ?? t('<Unnamed Repository>')}</TextOverflow>
          )}
          disabled={!organization.features.includes('custom-symbol-sources')}
          formatMessageValue={false}
          onAddItem={(item, addItem) =>
            openDebugFileSourceModal({
              sourceType: item.value,
              onSave: addItem,
            })
          }
          onEditItem={item => handleOpenDebugFileSourceModalToEdit(item.id)}
          removeConfirm={{
            confirmText: t('Remove Repository'),
            message: (
              <Fragment>
                <TextBlock>
                  <strong>
                    {t('Removing this repository applies instantly to new events.')}
                  </strong>
                </TextBlock>
                <TextBlock>
                  {t(
                    'Debug files from this repository will not be used to symbolicate future events. This may create new issues and alert members in your organization.'
                  )}
                </TextBlock>
              </Fragment>
            ),
          }}
          addDropdown={{items: dropDownItems}}
        />
      </Field>
    </Fragment>
  );
}

export default SymbolSources;

const StyledRichListField = styled(RichListField)`
  padding: 0;
`;

const StyledList = styled(List)`
  margin-top: ${space(1)};
`;

const ExpirationMessage = styled('span')`
  display: inline-grid;
  grid-gap: ${space(0.25)};
  grid-template-columns: max-content 1fr;
`;
