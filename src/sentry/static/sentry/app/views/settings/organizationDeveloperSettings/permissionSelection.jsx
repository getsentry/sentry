import PropTypes from 'prop-types';
import React from 'react';

import {find, flatMap} from 'lodash';

import {t} from 'app/locale';
import {SENTRY_APP_PERMISSIONS} from 'app/constants';
import ConsolidatedScopes from 'app/utils/consolidatedScopes';
import SelectField from 'app/views/settings/components/forms/selectField';

/**
 * Custom form element that presents API scopes in a resource-centric way. Meaning
 * a dropdown for each resource, that rolls up into a flat list of scopes.
 *
 *
 * API Scope vs Permission
 *
 *    "API Scopes" are the string identifier that gates an endpoint. For example,
 *    `project:read` or `org:admin`. They're made up of two parts:
 *
 *       <resource>:<access>
 *
 *    "Permissions" are a more user-friendly way of conveying this same information.
 *    They're roughly the same with one exception:
 *
 *       - No Access
 *       - Read
 *       - Read & Write
 *       - Admin
 *
 *    "Read & Write" actually maps to the `write` access level since `read` is
 *    implied. Similarly, `admin` implies `read` and `write`.
 *
 *    This components displays things per Resource. Meaning the User selects
 *    "Read", "Read & Write", or "Admin" for Project or Organization or etc.
 *
 *    == Scopes to Permissions
 *
 *    The first thing this component does on instantiation is take the list of API
 *    Scopes passed via `props` and converts them to "Permissions.
 *
 *    So a list of scopes like the following:
 *
 *       ['project:read', 'project:write', 'org:admin']
 *
 *    will become an object that looks like:
 *
 *       {
 *         'Project': 'write',
 *         'Organization': 'admin',
 *       }
 *
 *
 * State
 *
 *    This component stores state like the example object from above. When the
 *    User changes the Permission for a particular resource, it updates the
 *    `state.permissions` object to reflect the change.
 *
 *
 * Updating the Form Field Value
 *
 *    In addition to updating the state, when a value is changed this component
 *    recalculates the full list of API Scopes that need to be passed to the API.
 *
 *    So if the User has changed Project to "Admin" and Organization to "Read & Write",
 *    we end up with a `state.permissions` like:
 *
 *       {
 *         'Project': 'admin',
 *         'Organization': 'write',
 *       }
 *
 *    From there, we calculate the full list of API Scopes. This list includes all
 *    implied scopes, meaning the above state would result in:
 *
 *       ['project:read', 'project:write', 'project:admin', 'org:read', 'org:write']
 *
 */
export default class PermissionSelection extends React.Component {
  static contextTypes = {
    router: PropTypes.object.isRequired,
    form: PropTypes.object,
  };

  static propTypes = {
    scopes: PropTypes.arrayOf(PropTypes.string).isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      permissions: this.scopeListToPermissionState(),
    };
  }

  /**
   * Converts the list of raw API scopes passed in to an object that can
   * before stored and used via `state`. This object is structured by
   * resource and holds "Permission" values. For example:
   *
   *    {
   *      'Project': 'read',
   *      ...,
   *    }
   *
   */
  scopeListToPermissionState() {
    return new ConsolidatedScopes(this.props.scopes).toResourcePermissions();
  }

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
      ([r, p]) => findResource(r).choices[p].scopes
    );
  }

  onChange = (resource, choice) => {
    const {permissions} = this.state;

    permissions[resource] = choice;

    this.setState({permissions});
    this.context.form.setValue('scopes', this.permissionStateToList());
  };

  render() {
    const {permissions} = this.state;

    return (
      <React.Fragment>
        {SENTRY_APP_PERMISSIONS.map(config => {
          const toChoice = ([value, opt]) => [value, opt.label];
          const choices = Object.entries(config.choices).map(toChoice);
          const value = permissions[config.resource];

          return (
            <SelectField
              // These are not real fields we want submitted, so we use
              // `--permission` as a suffix here, then filter these
              // fields out when submitting the form in
              // sentryApplicationDetails.jsx
              name={`${config.resource}--permission`}
              key={config.resource}
              choices={choices}
              help={t(config.help)}
              label={t(config.label || config.resource)}
              onChange={this.onChange.bind(this, config.resource)}
              value={value}
              defaultValue={value}
            />
          );
        })}
      </React.Fragment>
    );
  }
}
