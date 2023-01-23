import {RouteComponentProps} from 'react-router';
import {Location} from 'history';
import cloneDeep from 'lodash/cloneDeep';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import AsyncComponent from 'sentry/components/asyncComponent';
import AvatarChooser from 'sentry/components/avatarChooser';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import organizationSettingsFields from 'sentry/data/forms/organizationGeneralSettings';
import {t} from 'sentry/locale';
import {Organization, Scope} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  access: Set<Scope>;
  initialData: Organization;
  location: Location;
  onSave: (previous: Organization, updated: Organization) => void;
  organization: Organization;
} & RouteComponentProps<{}, {}>;

type State = AsyncComponent['state'] & {
  authProvider: object;
};

class OrganizationSettingsForm extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization} = this.props;
    return [['authProvider', `/organizations/${organization.slug}/auth-provider/`]];
  }

  render() {
    const {initialData, organization, onSave, access} = this.props;
    const {authProvider} = this.state;
    const endpoint = `/organizations/${organization.slug}/`;

    const jsonFormSettings = {
      additionalFieldProps: {hasSsoEnabled: !!authProvider},
      features: new Set(organization.features),
      access,
      location: this.props.location,
      disabled: !access.has('org:write'),
    };

    const forms = cloneDeep(organizationSettingsFields);
    if (organization.features.includes('codecov-stacktrace-integration')) {
      forms[0].fields = [
        ...forms[0].fields,
        {
          name: 'codecovAccess',
          type: 'boolean',
          label: t('Enable Code Coverage Insights - powered by Codecov'),
          help: t('Opt-in to connect your codecov account'),
        },
      ];
    }

    return (
      <Form
        data-test-id="organization-settings"
        apiMethod="PUT"
        apiEndpoint={endpoint}
        saveOnBlur
        allowUndo
        initialData={initialData}
        onSubmitSuccess={(updated, _model) => {
          // Special case for slug, need to forward to new slug
          if (typeof onSave === 'function') {
            onSave(initialData, updated);
          }
        }}
        onSubmitError={() => addErrorMessage('Unable to save change')}
      >
        <JsonForm {...jsonFormSettings} forms={forms} />
        <AvatarChooser
          type="organization"
          allowGravatar={false}
          endpoint={`${endpoint}avatar/`}
          model={initialData}
          onSave={updateOrganization}
          disabled={!access.has('org:write')}
        />
      </Form>
    );
  }
}

export default withOrganization(OrganizationSettingsForm);
