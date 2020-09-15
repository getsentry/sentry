import {RouteComponentProps} from 'react-router/lib/Router';
import {Location} from 'history';
import React from 'react';

import {addErrorMessage} from 'app/actionCreators/indicator';
import {updateOrganization} from 'app/actionCreators/organizations';
import AsyncComponent from 'app/components/asyncComponent';
import AvatarChooser from 'app/components/avatarChooser';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import organizationSettingsFields from 'app/data/forms/organizationGeneralSettings';
import withOrganization from 'app/utils/withOrganization';
import {Organization, Scope} from 'app/types';

type Props = {
  location: Location;
  organization: Organization;
  access: Set<Scope>;
  initialData: Organization;
  onSave: (previous: Organization, updated: Record<string, any>) => void;
} & RouteComponentProps<{orgId: string}, {}>;

type State = AsyncComponent['state'] & {
  authProvider: object;
};

class OrganizationSettingsForm extends AsyncComponent<Props, State> {
  getEndpoints(): Array<[string, string]> {
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

    return (
      <Form
        data-test-id="organization-settings"
        apiMethod="PUT"
        apiEndpoint={endpoint}
        saveOnBlur
        allowUndo
        initialData={initialData}
        onSubmitSuccess={(_resp, model) => {
          // Special case for slug, need to forward to new slug
          if (typeof onSave === 'function') {
            onSave(initialData, model.initialData);
          }
        }}
        onSubmitError={() => addErrorMessage('Unable to save change')}
      >
        <JsonForm {...jsonFormSettings} forms={organizationSettingsFields} />
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
