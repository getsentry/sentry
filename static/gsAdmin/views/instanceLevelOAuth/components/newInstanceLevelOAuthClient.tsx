import {Fragment} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {TextField} from 'sentry/components/forms/fields/textField';
import {Form} from 'sentry/components/forms/form';
import {FormModel} from 'sentry/components/forms/model';

import {ClientSecretModal} from './clientSecretModal';

const fieldProps = {
  stacked: true,
  inline: false,
  flexibleControlStateSize: true,
} as const;

export function NewInstanceLevelOAuthClient({Body, Header}: ModalRenderProps) {
  const formModel = new FormModel();

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
        </Form>
      </Body>
    </Fragment>
  );
}
