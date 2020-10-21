import isObject from 'lodash/isObject';
import forEach from 'lodash/forEach';
import set from 'lodash/set';
import {Fragment} from 'react';

import {t} from 'app/locale';
import {openDebugFileSourceModal} from 'app/actionCreators/modal';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import {DEBUG_SOURCE_TYPES} from 'app/data/debugFileSources';
import TextBlock from 'app/views/settings/components/text/textBlock';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/projects/:projectId/debug-symbols/';

function flattenKeys(obj) {
  const result = {};
  forEach(obj, (value, key) => {
    if (isObject(value)) {
      forEach(value, (innerValue, innerKey) => {
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
  forEach(obj, (value, key) => {
    set(result, key.split('.'), value);
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
    formatMessageValue: (value, {builtinSymbolSources}) => {
      const rv = [];
      value.forEach(key => {
        builtinSymbolSources.forEach(source => {
          if (source.sentry_key === key) {
            rv.push(source.name);
          }
        });
      });
      return rv.join(', ');
    },
    choices: ({builtinSymbolSources}) =>
      builtinSymbolSources &&
      builtinSymbolSources
        .filter(source => !source.hidden)
        .map(source => [source.sentry_key, t(source.name)]),
  },
  symbolSources: {
    name: 'symbolSources',
    type: 'rich_list',
    label: t('Custom Repositories'),
    /* eslint-disable-next-line react/prop-types */
    help: ({organization}) => (
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
    ),
    disabled: ({features}) => !features.has('custom-symbol-sources'),
    formatMessageValue: false,
    addButtonText: t('Add Repository'),
    addDropdown: {
      items: [
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
      ],
    },

    getValue: sources => JSON.stringify(sources.map(unflattenKeys)),
    setValue: raw => (JSON.parse(raw || null) || []).map(flattenKeys),

    renderItem(item) {
      return item.name ? <span>{item.name}</span> : <em>{t('<Unnamed Repository>')}</em>;
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
    },
  },
};
