import {Component, Fragment, type ChangeEvent} from 'react';

import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {FieldDescription} from 'sentry/components/forms/fieldGroup/fieldDescription';
import {FieldHelp} from 'sentry/components/forms/fieldGroup/fieldHelp';
import {FieldLabel} from 'sentry/components/forms/fieldGroup/fieldLabel';
import {SelectField} from 'sentry/components/forms/fields/selectField';
import {FormContext} from 'sentry/components/forms/formContext';
import {FormField} from 'sentry/components/forms/formField';
import {
  CONTINUOUS_INTEGRATION_SENTRY_APP_PERMISSION,
  SENTRY_APP_PERMISSIONS,
  type PermissionObj,
} from 'sentry/constants';
import {t} from 'sentry/locale';
import type {
  PermissionResource,
  Permissions,
  PermissionValue,
} from 'sentry/types/integrations';

type PermissionErrors = Partial<Record<PermissionResource, string>>;

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
 *    === Scopes to Permissions
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

type Props = {
  appPublished: boolean;
  onChange: (permissions: Permissions, hasContinuousIntegration: boolean) => void;
  permissions: Permissions;
  continuousIntegrationError?: string;
  displaySpecialPermissions?: boolean;
  /**
   * Optional list of permissions to display in the selection.
   * Defaults to SENTRY_APP_PERMISSIONS if not provided.
   * Useful for limiting permissions available to personal tokens vs integration tokens.
   */
  displayedPermissions?: PermissionObj[];
  errors?: PermissionErrors;
  hasContinuousIntegration?: boolean;
};

type State = {
  hasContinuousIntegration: boolean;
  permissions: Permissions;
};

type SpecialPermissionFieldProps = {
  disabled: boolean;
  disabledReason: string;
  help: string;
  label: string;
  name: string;
  onChange: (value: boolean) => void;
  value: boolean;
};

function SpecialPermissionField({
  disabled,
  disabledReason,
  help,
  label,
  name,
  onChange,
  value,
}: SpecialPermissionFieldProps) {
  return (
    <FormField
      defaultValue={value}
      disabled={disabled}
      disabledReason={disabledReason}
      name={name}
      onChange={onChange}
    >
      {({id, onChange: formOnChange, value: checked}: any) => {
        const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
          formOnChange(event.target.checked, event);
        };

        return (
          <Tooltip title={disabledReason} skipWrapper disabled={!disabled}>
            <Flex direction="row">
              <Flex as="span" alignSelf="flex-start" marginRight="md">
                <Checkbox
                  id={id}
                  name={name}
                  disabled={disabled}
                  checked={checked === true}
                  onChange={handleChange}
                />
              </Flex>
              <FieldDescription htmlFor={id} aria-label={label}>
                <FieldLabel disabled={disabled}>
                  <span>{label}</span>
                </FieldLabel>
                <FieldHelp inline>{help}</FieldHelp>
              </FieldDescription>
            </Flex>
          </Tooltip>
        );
      }}
    </FormField>
  );
}

function findResource(r: PermissionResource) {
  return SENTRY_APP_PERMISSIONS.find(permissions => permissions.resource === r);
}

/**
 * Converts the "Permission" values held in `state` to a list of raw
 * API scopes we can send to the server. For example:
 *
 *    ['org:read', 'org:write', ...]
 *
 */
export function permissionStateToList(
  permissions: Permissions,
  hasContinuousIntegration: boolean
) {
  const scopes = Object.entries(permissions).flatMap(
    ([r, p]) => findResource(r as PermissionResource)?.choices?.[p]?.scopes ?? []
  );

  if (hasContinuousIntegration) {
    scopes.push(CONTINUOUS_INTEGRATION_SENTRY_APP_PERMISSION.scope);
  }

  return scopes;
}

export class PermissionSelection extends Component<Props, State> {
  state: State = {
    hasContinuousIntegration: this.props.hasContinuousIntegration ?? false,
    permissions: this.props.permissions,
  };

  componentDidMount() {
    this.context.form?.setValue(
      CONTINUOUS_INTEGRATION_SENTRY_APP_PERMISSION.fieldName,
      this.state.hasContinuousIntegration
    );
  }

  declare context: Required<React.ContextType<typeof FormContext>>;
  static contextType = FormContext;

  onChange = (resource: PermissionResource, choice: PermissionValue) => {
    this.save({
      permissions: {
        ...this.state.permissions,
        [resource]: choice,
      },
    });
  };

  onContinuousIntegrationChange = (hasContinuousIntegration: boolean) => {
    this.save({hasContinuousIntegration});
  };

  save = (stateUpdate: Partial<State>) => {
    const nextState = {...this.state, ...stateUpdate};
    this.setState(nextState);
    this.props.onChange(nextState.permissions, nextState.hasContinuousIntegration);
    // When used inside a legacy FormModel-based form, sync the scopes field.
    // When used outside that context (e.g. with useScrapsForm), the parent
    // derives scopes from the onChange callback instead.
    this.context.form?.setValue(
      'scopes',
      permissionStateToList(nextState.permissions, nextState.hasContinuousIntegration)
    );
  };

  render() {
    const {hasContinuousIntegration, permissions} = this.state;
    const {
      continuousIntegrationError,
      displaySpecialPermissions = true,
      displayedPermissions = SENTRY_APP_PERMISSIONS,
      errors,
    } = this.props;

    return (
      <Fragment>
        {displayedPermissions.map(config => {
          const options = Object.entries(config.choices).map(([value, {label}]) => ({
            value,
            label,
          }));

          const value = permissions[config.resource];
          const errorMessage = errors?.[config.resource];

          return (
            <Fragment key={config.resource}>
              <SelectField
                // These are not real fields we want submitted, so we use
                // `--permission` as a suffix here, then filter these
                // fields out when submitting the form in
                // sentryApplicationDetails.jsx
                name={`${config.resource}--permission`}
                options={options}
                help={config.help}
                label={config.label || config.resource}
                onChange={this.onChange.bind(this, config.resource)}
                value={value}
                defaultValue={value}
                disabled={this.props.appPublished}
                disabledReason={t('Cannot update permissions on a published integration')}
              />
              {errorMessage ? (
                <Text variant="danger" size="sm" role="alert">
                  {errorMessage}
                </Text>
              ) : null}
            </Fragment>
          );
        })}
        {displaySpecialPermissions && (
          <Fragment>
            <SpecialPermissionField
              name={CONTINUOUS_INTEGRATION_SENTRY_APP_PERMISSION.fieldName}
              label={CONTINUOUS_INTEGRATION_SENTRY_APP_PERMISSION.label}
              help={CONTINUOUS_INTEGRATION_SENTRY_APP_PERMISSION.help}
              onChange={this.onContinuousIntegrationChange}
              value={hasContinuousIntegration}
              disabled={this.props.appPublished}
              disabledReason={t('Cannot update permissions on a published integration')}
            />
            {continuousIntegrationError ? (
              <Text variant="danger" size="sm" role="alert">
                {continuousIntegrationError}
              </Text>
            ) : null}
          </Fragment>
        )}
      </Fragment>
    );
  }
}
