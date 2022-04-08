import {Component} from 'react';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {Field} from 'sentry/components/forms/type';
import {t} from 'sentry/locale';
import {Integration, Organization} from 'sentry/types';

type Props = {
  integration: Integration;
  onUpdate: () => void;
  organization: Organization;
};

type State = {
  integration: Integration;
};

class IntegrationMainSettings extends Component<Props, State> {
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
