import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {openDebugFileSourceModal} from 'app/actionCreators/modal';
import ProjectActions from 'app/actions/projectActions';
import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import {Item} from 'app/components/dropdownAutoComplete/types';
import {DEBUG_SOURCE_TYPES} from 'app/data/debugFileSources';
import {t} from 'app/locale';
import {Organization, Project} from 'app/types';
import Field from 'app/views/settings/components/forms/field';
import RichListField from 'app/views/settings/components/forms/richListField';
import TextBlock from 'app/views/settings/components/text/textBlock';

import {unflattenKeys} from './utils';

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

type Props = {
  api: Client;
  organization: Organization;
  projectSlug: Project['slug'];
  symbolSources: Item[];
};

function SymbolSources({api, organization, symbolSources, projectSlug}: Props) {
  const hasSavedAppStoreConnect = symbolSources.find(
    symbolSource => symbolSource.type === 'AppStoreConnect'
  );

  if (
    organization.features?.includes('app-store-connect') &&
    !hasSavedAppStoreConnect &&
    !dropDownItems.find(dropDownItem => dropDownItem.value === 'appStoreConnect')
  ) {
    dropDownItems.push({
      value: 'appStoreConnect',
      label: t(DEBUG_SOURCE_TYPES.appStoreConnect),
      searchKey: t('apple store connect'),
    });
  }

  const filteredSymbolSources = symbolSources.filter(
    symbolSource => symbolSource.type !== 'AppStoreConnect'
  );

  async function handleSave(
    updatedSymbolSources: string,
    successMessage: string,
    errorMessage: string
  ) {
    try {
      const updatedProjectDetails: Project = await api.requestPromise(
        `/projects/${organization.slug}/${projectSlug}/`,
        {
          method: 'PUT',
          data: {
            symbolSources: updatedSymbolSources,
          },
        }
      );

      ProjectActions.updateSuccess(updatedProjectDetails);
      addSuccessMessage(successMessage);
    } catch {
      addErrorMessage(errorMessage);
    }
  }

  function handleAddSymbolSource(newSymbolSource: Record<string, string>) {
    const updatedSymbolSources = JSON.stringify(
      [...filteredSymbolSources, newSymbolSource].map(unflattenKeys)
    );

    handleSave(
      updatedSymbolSources,
      t('Successfully added custom repository'),
      t('An error occured while adding new custom repository')
    );
  }

  function handleRemoveSymbolSource(symbolSourceIndex: number) {
    const newSymbolSources = [...filteredSymbolSources];
    newSymbolSources.splice(symbolSourceIndex, 1);
    const updatedSymbolSources = JSON.stringify(newSymbolSources.map(unflattenKeys));

    handleSave(
      updatedSymbolSources,
      t('Successfully removed custom repository'),
      t('An error occured while removing custom repository')
    );
  }

  function handleUpdateSymbolSource() {}

  return (
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
        value={symbolSources}
        renderItem={item => {
          return item.name ? (
            <span>{item.name}</span>
          ) : (
            <em>{t('<Unnamed Repository>')}</em>
          );
        }}
        disabled={!organization.features.includes('custom-symbol-sources')}
        formatMessageValue={false}
        onAddItem={item =>
          openDebugFileSourceModal({
            sourceType: item.value,
            onSave: handleAddSymbolSource,
          })
        }
        onEditItem={item =>
          openDebugFileSourceModal({
            sourceConfig: item,
            sourceType: item.type,
            onSave: handleUpdateSymbolSource,
          })
        }
        onRemoveItem={(_item, index) => handleRemoveSymbolSource(index)}
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
  );
}

export default SymbolSources;

const StyledRichListField = styled(RichListField)`
  display: flex;
  padding: 0;
  li {
    height: 32px;
  }
`;
