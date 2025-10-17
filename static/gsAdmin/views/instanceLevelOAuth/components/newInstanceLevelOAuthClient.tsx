import {Fragment} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import CheckboxField from 'sentry/components/forms/fields/checkboxField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import ConfigStore from 'sentry/stores/configStore';
import PermissionSelection from 'sentry/views/settings/organizationDeveloperSettings/permissionSelection';

import ClientSecretModal from './clientSecretModal';

const fieldProps = {
  stacked: true,
  inline: false,
  flexibleControlStateSize: true,
} as const;

function NewInstanceLevelOAuthClient({Body, Header}: ModalRenderProps) {
  const systemFeatures = ConfigStore.get('features');
  const formModel = new InstanceLevelOAuthClientModel();

  return (
    <Fragment>
      <Header closeButton>
        <h4>Create New Instance Level OAuth Client</h4>
      </Header>
      <Body>
        <Form
          apiMethod="POST"
          apiEndpoint="/_admin/instance-level-oauth/"
          model={formModel}
          onSubmitSuccess={(data: any) => {
            openModal(deps => (
              <ClientSecretModal
                {...deps}
                clientSecret={data.clientSecret}
                clientID={data.clientID}
              />
            ));
          }}
          submitLabel="Create Client"
        >
          <TextField
            {...fieldProps}
            name="name"
            label="Client Name"
            placeholder="e.g. Sentry"
            help="Human readable name for the client."
            required
          />
          <TextField
            {...fieldProps}
            name="redirectUris"
            label="Redirect URIs"
            placeholder="e.g. https://sentry.io/"
            help="The URLs that users will redirect to after login/signup. Space separated!"
            required
          />
          <TextField
            {...fieldProps}
            name="allowedOrigins"
            label="Allowed Origins"
            placeholder="e.g. https://sentry.io/"
            help="Allowed origins for the client. Space separated!"
          />
          <TextField
            {...fieldProps}
            name="homepageUrl"
            label="Homepage URL"
            placeholder="e.g. https://sentry.io/"
            help="Client's homepage"
          />
          <TextField
            {...fieldProps}
            name="privacyUrl"
            label="Privacy Policy URL"
            placeholder="e.g. https://sentry.io/privacy/"
            help="URL to client's privacy policy"
          />
          <TextField
            {...fieldProps}
            name="termsUrl"
            label="Terms and Conditions URL"
            placeholder="e.g. https://sentry.io/terms/"
            help="URL to client's terms and conditions"
          />
          {systemFeatures.has('system:scoped-partner-oauth') && (
            <Fragment>
              <Panel>
                <PanelHeader>Permissions</PanelHeader>
                <PanelBody withPadding>
                  <PermissionSelection
                    permissions={{
                      Event: 'no-access',
                      Member: 'no-access',
                      Organization: 'no-access',
                      Project: 'no-access',
                      Release: 'no-access',
                      Team: 'no-access',
                      Distribution: 'no-access',
                    }}
                    onChange={() => {}}
                    appPublished={false}
                  />
                </PanelBody>
              </Panel>
              <CheckboxField
                label="Requires organization level access"
                help="If enabled, at the time of installation the user will select only one organization which then the client will have access to."
                name="requiresOrgLevelAccess"
              />
            </Fragment>
          )}
        </Form>
      </Body>
    </Fragment>
  );
}

class InstanceLevelOAuthClientModel extends FormModel {
  /**
   * Filter out Permission input field values.
   *
   * Permissions (API Scopes) are presented as a list of SelectFields.
   * Instead of them being submitted individually, we want them rolled
   * up into a single list of scopes (this is done in `PermissionSelection`).
   *
   * Because they are all individual inputs, we end up with attributes
   * in the JSON we send to the API that we don't want.
   *
   * This function filters those attributes out of the data that is
   * ultimately sent to the API.
   */
  getData() {
    return this.fields.toJSON().reduce((data, [k, v]) => {
      if (!k.endsWith('--permission')) {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        data[k] = v;
      }
      return data;
    }, {});
  }
}

export default NewInstanceLevelOAuthClient;
