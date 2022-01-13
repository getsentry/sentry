import {Component, Fragment} from 'react';
import find from 'lodash/find';
import flatMap from 'lodash/flatMap';

import {SENTRY_APP_PERMISSIONS} from 'sentry/constants';
import {t} from 'sentry/locale';
import {Permissions} from 'sentry/types/index';
import FormContext from 'sentry/views/settings/components/forms/formContext';
import SelectField from 'sentry/views/settings/components/forms/selectField';

interface Props {
  permissions: Permissions;
  onChange: (permissions: Permissions) => void;
  appPublished: boolean;
}

interface State {
  permissions: Permissions;
}

export default class PermissionSelection extends Component<Props, State> {
  state: State = {
    permissions: this.props.permissions,
  };

  static contextType = FormContext;

  /**
   * Converts the "Permission" values held in `state` to a list of raw
   * API scopes we can send to the server. For example:
   *
   *    ['org:read', 'org:write', ...]
   *
   */
  permissionStateToList() {
    const {permissions} = this.state;
    const findResource = r => find(SENTRY_APP_PERMISSIONS, ['resource', r]);
    return flatMap(
      Object.entries(permissions),
      ([r, p]) => findResource(r)?.choices?.[p]?.scopes
    );
  }

  onChange = (resource, choice) => {
    const {permissions} = this.state;
    permissions[resource] = choice;
    this.save(permissions);
  };

  save = permissions => {
    this.setState({permissions});
    this.props.onChange(permissions);
    this.context.form.setValue('scopes', this.permissionStateToList());
  };

  render() {
    const {permissions} = this.state;

    return (
      <Fragment>
        {SENTRY_APP_PERMISSIONS.map(config => {
          const toOption = ([value, {label}]) => ({value, label});
          const options = Object.entries(config.choices).map(toOption);
          const value = permissions[config.resource];

          return (
            <SelectField
              // These are not real fields we want submitted, so we use
              // `--permission` as a suffix here, then filter these
              // fields out when submitting the form in
              // sentryApplicationDetails.jsx
              name={`${config.resource}--permission`}
              key={config.resource}
              options={options}
              help={t(config.help)}
              label={t(config.label || config.resource)}
              onChange={this.onChange.bind(this, config.resource)}
              value={value}
              defaultValue={value}
              disabled={this.props.appPublished}
              disabledReason={t('Cannot update permissions on a published integration')}
            />
          );
        })}
      </Fragment>
    );
  }
}
