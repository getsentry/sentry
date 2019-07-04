import _ from 'lodash';
import React from 'react';

import {t} from 'app/locale';
import {openDebugFileSourceModal} from 'app/actionCreators/modal';
import TextBlock from 'app/views/settings/components/text/textBlock';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/projects/:projectId/debug-symbols/';

export const sourceNames = {
  gcs: t('Google Cloud Storage'),
  http: t('SymbolServer (HTTP)'),
  s3: t('Amazon S3'),
};

export function getSourceName(type) {
  return sourceNames[type] || t('Unknown');
}

function flattenKeys(obj) {
  const result = {};
  _.forEach(obj, (value, key) => {
    if (_.isObject(value)) {
      _.forEach(value, (innerValue, innerKey) => {
        result[`${key}.${innerKey}`] = innerValue;
      });
    } else {
      result[key] = value;
    }
  });
  return result;
}

function unflattenKeys(obj) {
  const result = {};
  _.forEach(obj, (value, key) => {
    _.set(result, key.split('.'), value);
  });
  return result;
}

export const fields = {
  builtinSymbolSources: {
    name: 'builtinSymbolSources',
    type: 'select',
    multiple: true,
    label: t('Built-in Repositories'),
    help: t(
      'Configures which built-in repositories Sentry should use to resolve debug files.'
    ),
    choices: ({builtinSymbolSources}) =>
      builtinSymbolSources &&
      builtinSymbolSources.map(source => [source.sentry_key, t(source.name)]),
  },
  symbolSources: {
    name: 'symbolSources',
    type: 'rich_list',
    label: t('Custom Repositories'),
    help: t('Configures custom repositories containing debug files.'),
    formatMessageValue: false,
    addButtonText: t('Add Repository'),
    addDropdown: {
      items: [
        {
          value: 's3',
          label: sourceNames.s3,
          searchKey: t('aws amazon s3 bucket'),
        },
        {
          value: 'gcs',
          label: sourceNames.gcs,
          searchKey: t('gcs google cloud storage bucket'),
        },
        {
          value: 'http',
          label: sourceNames.http,
          searchKey: t('http symbol server ssqp symstore symsrv'),
        },
      ],
    },

    getValue: sources => JSON.stringify(sources.map(unflattenKeys)),
    setValue: raw => (JSON.parse(raw || null) || []).map(flattenKeys),

    renderItem(item) {
      if (item.name) {
        return item.name;
      } else {
        return <em>{t('<Unnamed Repository>')}</em>;
      }
    },

    onAddItem(item, addItem) {
      openDebugFileSourceModal({
        sourceType: item.value,
        onSave: addItem,
      });
    },

    onEditItem(item, updateItem) {
      openDebugFileSourceModal({
        sourceConfig: item,
        sourceType: item.type,
        onSave: updateItem,
      });
    },

    removeConfirm: {
      title: t('Remove Repository?'),
      confirmText: t('Remove Repository'),
      message: (
        <>
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
        </>
      ),
    },
  },
};
