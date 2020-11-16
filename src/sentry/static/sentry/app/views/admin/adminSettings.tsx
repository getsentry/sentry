import React from 'react';
import isUndefined from 'lodash/isUndefined';

import AsyncView from 'app/views/asyncView';
import {t} from 'app/locale';
import {ApiForm} from 'app/components/forms';

import {getOption, getOptionField} from './options';

const optionsAvailable = [
  'system.url-prefix',
  'system.admin-email',
  'system.support-email',
  'system.security-email',
  'system.rate-limit',
  'auth.allow-registration',
  'auth.ip-rate-limit',
  'auth.user-rate-limit',
  'api.rate-limit.org-create',
  'beacon.anonymous',
];

type Field = ReturnType<typeof getOption>;

type FieldDef = {
  field: Field;
  value: string | undefined;
};

type State = AsyncView['state'] & {
  data: Record<string, FieldDef>;
};

export default class AdminSettings extends AsyncView<{}, State> {
  get endpoint() {
    return '/internal/options/';
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['data', this.endpoint]];
  }

  renderBody() {
    const {data} = this.state;

    const initialData = {};
    const fields = {};
    for (const key of optionsAvailable) {
      // TODO(dcramer): we should not be mutating options
      const option = data[key] ?? {field: {}, value: undefined};

      if (isUndefined(option.value) || option.value === '') {
        const defn = getOption(key);
        initialData[key] = defn.defaultValue ? defn.defaultValue() : '';
      } else {
        initialData[key] = option.value;
      }
      fields[key] = getOptionField(key, option.field);
    }

    return (
      <div>
        <h3>{t('Settings')}</h3>

        <ApiForm
          apiMethod="PUT"
          apiEndpoint={this.endpoint}
          initialData={initialData}
          requireChanges
        >
          <h4>General</h4>
          {fields['system.url-prefix']}
          {fields['system.admin-email']}
          {fields['system.support-email']}
          {fields['system.security-email']}
          {fields['system.rate-limit']}

          <h4>Security & Abuse</h4>
          {fields['auth.allow-registration']}
          {fields['auth.ip-rate-limit']}
          {fields['auth.user-rate-limit']}
          {fields['api.rate-limit.org-create']}

          <h4>Beacon</h4>
          {fields['beacon.anonymous']}
        </ApiForm>
      </div>
    );
  }
}
