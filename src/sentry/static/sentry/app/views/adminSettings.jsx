import React from 'react';
import _ from 'lodash';

import AsyncView from './asyncView';
import {t} from '../locale';
import {getOption, getOptionField} from '../options';
import {ApiForm} from '../components/forms';

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
  'beacon.anonymous'
];

export default class AdminSettings extends AsyncView {
  getEndpoint() {
    return '/internal/options/';
  }

  renderBody() {
    let {data} = this.state;

    let initialData = {};
    let fields = {};
    for (let key of optionsAvailable) {
      // TODO(dcramer): we should not be mutating options
      let option = data[key] || {field: {}};
      if (_.isUndefined(option.value) || option.value === '') {
        let defn = getOption(key);
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
          apiEndpoint={this.getEndpoint()}
          onSubmit={this.onSubmit}
          initialData={initialData}
          requireChanges={true}>
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
