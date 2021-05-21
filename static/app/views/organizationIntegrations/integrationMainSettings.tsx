import React from 'react';

import {addSuccessMessage} from 'app/actionCreators/indicator';
import {t} from 'app/locale';
import {Integration, Organization} from 'app/types';
import Form from 'app/views/settings/components/forms/form';
import JsonForm from 'app/views/settings/components/forms/jsonForm';
import {Field} from 'app/views/settings/components/forms/type';

type Props = {
  integration: Integration;
  organization: Organization;
  onUpdate: () => void;
};

type State = {
  integration: Integration;
};

class IntegrationMainSettings extends React.Component<Props, State> {
  state: State = {
    integration: this.props.integration,
  };

  handleSubmitSuccess = (data: Integration) => {
    addSuccessMessage(t('Integration updated.'));
    this.props.onUpdate();
    this.setState({integration: data});
  };

  get initialData() {
    const {integration} = this.props;

    return {
      name: integration.name,
      domain: integration.domainName || '',
    };
  }

  get formFields(): Field[] {
    const fields: any[] = [
      {
        name: 'name',
        type: 'string',
        required: false,
        label: t('Integration Name'),
      },
      {
        name: 'domain',
        type: 'string',
        required: false,
        label: t('Full URL'),
      },
    ];
    return fields;
  }

  render() {
    const {integration} = this.state;
    const {organization} = this.props;
    return (
      <Form
        initialData={this.initialData}
        apiMethod="PUT"
        apiEndpoint={`/organizations/${organization.slug}/integrations/${integration.id}/`}
        onSubmitSuccess={this.handleSubmitSuccess}
        submitLabel={t('Save Settings')}
      >
        <JsonForm fields={this.formFields} />
      </Form>
    );
  }
}

export default IntegrationMainSettings;
